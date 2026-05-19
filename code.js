figma.showUI(__html__, { width: 380, height: 560, themeColors: true });

let pendingRequest = null;

figma.ui.onmessage = async (message) => {
  try {
    if (message.type === 'create-border') {
      await exportSelectionForTracing(message.settings || {});
      return;
    }

    if (message.type === 'svg-ready') {
      await importSilhouetteAndGroup(message);
      return;
    }

    if (message.type === 'trace-error') {
      figma.notify(message.message || 'Unable to trace PNG alpha.');
      return;
    }
  } catch (error) {
    const text = error && error.message ? error.message : String(error);
    figma.notify(text, { error: true });
    figma.ui.postMessage({ type: 'status', level: 'error', message: text });
  }
};

async function exportSelectionForTracing(settings) {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    throw new Error('Select exactly one PNG/image node or transparent object.');
  }

  const node = selection[0];

  if (!('exportAsync' in node)) {
    throw new Error('The selected node cannot be exported as a PNG.');
  }

  if (!('width' in node) || !('height' in node) || node.width <= 0 || node.height <= 0) {
    throw new Error('The selected node has no usable dimensions.');
  }

  pendingRequest = {
    nodeId: node.id,
    settings,
  };

  figma.ui.postMessage({ type: 'status', level: 'info', message: 'Exporting selected node as PNG…' });

  const bytes = await node.exportAsync({ format: 'PNG' });

  figma.ui.postMessage({
    type: 'trace-png',
    bytes,
    settings,
    node: {
      id: node.id,
      name: node.name,
      width: node.width,
      height: node.height,
    },
  });
}

async function importSilhouetteAndGroup(message) {
  const nodeId = message.nodeId || (pendingRequest && pendingRequest.nodeId);
  const settings = message.settings || (pendingRequest && pendingRequest.settings) || {};
  const original = figma.getNodeById(nodeId);

  if (!original || !('parent' in original) || !original.parent) {
    throw new Error('The original node is no longer available.');
  }

  if (!('width' in original) || !('height' in original)) {
    throw new Error('The original node has no usable dimensions.');
  }

  const parent = original.parent;
  if (!('children' in parent) || typeof parent.insertChild !== 'function') {
    throw new Error('Cannot add the border next to the selected node. Try selecting a top-level editable PNG/image layer.');
  }

  figma.ui.postMessage({ type: 'status', level: 'info', message: 'Importing SVG silhouette…' });

  const border = figma.createNodeFromSvg(message.svg);
  border.name = `${original.name} alpha border`;

  const originalIndex = parent.children.indexOf(original);
  parent.insertChild(Math.max(0, originalIndex), border);

  // Size first, then copy the selected node transform so rotated/flipped nodes align.
  if ('resize' in border) {
    border.resize(original.width, original.height);
  }
  if ('relativeTransform' in original && 'relativeTransform' in border) {
    border.relativeTransform = original.relativeTransform;
  } else {
    border.x = original.x;
    border.y = original.y;
  }

  applyBorderStyle(border, settings);

  // Keep the imported SVG frame from clipping an outside stroke.
  if ('clipsContent' in border) {
    border.clipsContent = false;
  }

  const groupIndex = parent.children.indexOf(border);
  const group = figma.group([border, original], parent, groupIndex);
  group.name = `${original.name} with alpha border`;

  figma.currentPage.selection = [group];
  figma.viewport.scrollAndZoomIntoView([group]);

  const stats = message.stats || {};
  const contours = typeof stats.contours === 'number' ? `${stats.contours} contour${stats.contours === 1 ? '' : 's'}` : 'silhouette';
  figma.notify(`Created outside stroke from ${contours}.`);
  figma.ui.postMessage({ type: 'status', level: 'success', message: 'Done. Border grouped with original PNG.' });

  pendingRequest = null;
}

function applyBorderStyle(root, settings) {
  const strokePaint = {
    type: 'SOLID',
    color: parseHexColor(settings.strokeColor || '#FFFFFF'),
    opacity: clampNumber(settings.strokeOpacity, 0, 1, 1),
  };

  const fillBacking = settings.fillBacking !== false;
  const fillPaint = {
    type: 'SOLID',
    color: strokePaint.color,
    opacity: fillBacking ? strokePaint.opacity : 0,
  };

  const strokeWeight = Math.max(0.01, Number(settings.strokeWidth) || 12);
  const roundJoins = settings.roundJoins !== false;

  walk(root, (node) => {
    if ('clipsContent' in node) {
      try {
        node.clipsContent = false;
      } catch (error) {
        // Some imported nodes may not allow this; ignore.
      }
    }

    // Do not put a stroke on the imported SVG container frame; that would
    // create a rectangular border. Style only actual geometry nodes.
    if (!isDrawableNode(node)) {
      return;
    }

    if ('fills' in node) {
      try {
        node.fills = [fillPaint];
      } catch (error) {
        // Ignore read-only fills.
      }
    }

    if ('strokes' in node) {
      try {
        node.strokes = [strokePaint];
      } catch (error) {
        // Ignore read-only strokes.
      }
    }

    if ('strokeWeight' in node) {
      try {
        node.strokeWeight = strokeWeight;
      } catch (error) {
        // Ignore unsupported stroke weights.
      }
    }

    if ('strokeAlign' in node) {
      try {
        node.strokeAlign = 'OUTSIDE';
      } catch (error) {
        // Ignore unsupported stroke alignment.
      }
    }

    if ('strokeJoin' in node) {
      try {
        node.strokeJoin = roundJoins ? 'ROUND' : 'MITER';
      } catch (error) {
        // Ignore unsupported joins.
      }
    }

    if ('strokeCap' in node) {
      try {
        node.strokeCap = 'ROUND';
      } catch (error) {
        // Ignore unsupported caps.
      }
    }
  });
}

function walk(node, callback) {
  callback(node);
  if ('children' in node) {
    for (const child of node.children) {
      walk(child, callback);
    }
  }
}

function isDrawableNode(node) {
  return !['FRAME', 'GROUP', 'SECTION', 'PAGE', 'DOCUMENT', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(node.type);
}

function parseHexColor(value) {
  let hex = String(value || '').trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map((character) => character + character).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    hex = 'FFFFFF';
  }

  const number = parseInt(hex, 16);
  return {
    r: ((number >> 16) & 255) / 255,
    g: ((number >> 8) & 255) / 255,
    b: (number & 255) / 255,
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}
