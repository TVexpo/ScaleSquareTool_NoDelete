// export.module.js - independent export module (no globals)
(function(global){
  function createExportModule({ getBgCanvas, getOverlaySvg, getTheme, getOutlineColor }){
    let _clickHandler = null;
    function exportPNG(filename = 'export.png'){
      const bgCanvas = getBgCanvas();
      const overlay = getOverlaySvg();
      const theme = getTheme();
      const outline = getOutlineColor();

      const out = document.createElement('canvas');
      out.width = bgCanvas.width;
      out.height = bgCanvas.height;
      const octx = out.getContext('2d');
      octx.drawImage(bgCanvas, 0, 0);

      const ov = overlay.cloneNode(true);
      ov.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      ov.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      if (!ov.getAttribute('width')) ov.setAttribute('width', String(bgCanvas.width));
      if (!ov.getAttribute('height')) ov.setAttribute('height', String(bgCanvas.height));
      if (!ov.getAttribute('viewBox')) ov.setAttribute('viewBox', `0 0 ${bgCanvas.width} ${bgCanvas.height}`);

      const isDark = theme === 'dark';
      const textColor = isDark ? '#ffffff' : '#202431';
      const strokeText = isDark ? '#1d2129' : '#f2f4f8';
      const accent = isDark ? '#6ea8fe' : '#2456d6';
      const style = document.createElementNS('http://www.w3.org/2000/svg','style');
      style.textContent = `
        text.dim{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
          font-size:12px; fill:${textColor}; paint-order:stroke; stroke:${strokeText}; stroke-width:3px; }
        .line-guide{ stroke:${accent}; stroke-width:2; stroke-dasharray:5 6; fill:none; }
        .handle{ fill:${accent}; stroke:${strokeText}; stroke-width:2; }
        .handle[data-kind="move"], .handle[data-kind="rmove"], .handle[data-kind="rwidth"], .handle[data-kind="rheight"]{ fill:#a9b0bd; }
      `;
      ov.insertBefore(style, ov.firstChild);

      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(ov);
      const svgBlob = new Blob([xml], {type:'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        octx.drawImage(img, 0, 0);
        // border
        octx.save();
        octx.strokeStyle = outline;
        octx.lineWidth = 1;
        octx.strokeRect(0.5, 0.5, out.width-1, out.height-1);
        octx.restore();

        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.download = filename;
        a.href = out.toDataURL('image/png');
        a.click();
      };
      img.onerror = () => {
        alert('匯出失敗：瀏覽器阻擋或內容不安全。請改用不同圖片或同網域環境開啟。');
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }

    function bindUI({ exportBtn, filename = 'export.png' }) {
      if (exportBtn){
        _clickHandler = () => exportPNG(filename);
        exportBtn.addEventListener('click', _clickHandler);
      }
      return () => {
        if (exportBtn && _clickHandler){
          exportBtn.removeEventListener('click', _clickHandler);
          _clickHandler = null;
        }
      };
    }

    return { exportPNG, bindUI };
  }

  global.CreateExportModule = createExportModule;
})(window);
