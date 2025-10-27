(() => {
  const el = id => document.getElementById(id);
  const canvas = el('c');
  const ctx = canvas.getContext('2d');

  // STATE
  const state = {
    img:null,
    logo:null,
    titleFont:'TrueNo-Black',
    bodyFont:'TrueNo-Regular',
    // Native/design resolution (from base image)
    nativeWidth: 0,
    nativeHeight: 0,
    // Display scale factor
    scale: 1,
  };

  // Load fonts automatically
  async function loadFonts() {
    try {
      // Load TrueNo Black for titles
      const titleFontFace = new FontFace('TrueNo-Black', 'url(font/truenoblk.otf)');
      await titleFontFace.load();
      document.fonts.add(titleFontFace);
      state.titleFont = 'TrueNo-Black';
      console.log('TrueNo Black font loaded for titles');

      // Load TrueNo Regular for body text
      const bodyFontFace = new FontFace('TrueNo-Regular', 'url(font/truenorg.otf)');
      await bodyFontFace.load();
      document.fonts.add(bodyFontFace);
      state.bodyFont = 'TrueNo-Regular';
      console.log('TrueNo Regular font loaded for body text');
      
      // Re-render with fonts loaded
      if (state.img) render();
    } catch (e) {
      console.warn('Font loading failed, using fallback fonts:', e);
      state.titleFont = 'system-ui';
      state.bodyFont = 'system-ui';
    }
  }

  // Load default pearl image
  function loadDefaultImage(){
    const img = new Image();
    img.onload = () => {
      console.log('Pearl image loaded successfully', img.width, 'x', img.height);
      state.img = img;
      // Store native resolution from the base image
      state.nativeWidth = img.width;
      state.nativeHeight = img.height;
      console.log('Native resolution set to:', state.nativeWidth, 'x', state.nativeHeight);
      // Calculate optimal canvas size based on available space
      setCanvasSize();
      render();
    };
    img.onerror = (e) => {
      console.error('Failed to load pearl image:', e);
      console.error('Attempted path: img/pearl.jpg');
      // Fallback: set default native resolution and canvas size
      state.nativeWidth = 1600;
      state.nativeHeight = 2560;
      canvas.width = 1600;
      canvas.height = 2560;
      render();
    };
    img.src = 'img/pearl.jpg';
    console.log('Attempting to load image from:', img.src);
  }

  // Load default logo
  function loadDefaultLogo(){
    const logo = new Image();
    logo.onload = () => {
      console.log('Logo loaded successfully', logo.width, 'x', logo.height);
      state.logo = logo;
      // Re-render with logo
      if (state.img) render();
    };
    logo.onerror = (e) => {
      console.warn('Failed to load logo:', e);
      console.warn('Attempted path: img/logo.png');
      // Continue without logo
    };
    logo.src = 'img/logo.png';
    console.log('Attempting to load logo from:', logo.src);
  }

  // Calculate and set optimal canvas size
  function setCanvasSize() {
    if (!state.img || !state.nativeWidth || !state.nativeHeight) return;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Account for control panel width (360px + gap + margins)
    const controlPanelWidth = 360;
    const bodyPadding = 32; // 16px on each side from body padding
    const gap = 16; // gap between panel and stage
    
    // Available space for canvas (be more conservative)
    const availableWidth = viewportWidth - controlPanelWidth - bodyPadding - gap;
    const availableHeight = viewportHeight - bodyPadding; // Account for top/bottom padding
    
    // Add generous safety margins to ensure no scrollbars ever appear
    const maxWidth = Math.max(250, availableWidth - 100);  // More conservative
    const maxHeight = Math.max(350, availableHeight - 100); // More conservative
    
    // Calculate aspect ratio of the native image
    const nativeAspectRatio = state.nativeWidth / state.nativeHeight;
    
    // Calculate the size that fits within BOTH constraints using the more restrictive one
    const scaleByWidth = maxWidth / state.nativeWidth;
    const scaleByHeight = maxHeight / state.nativeHeight;
    
    // Use the smaller scale factor to ensure it fits in both dimensions
    const finalScale = Math.min(scaleByWidth, scaleByHeight);
    
    const displayWidth = Math.round(state.nativeWidth * finalScale);
    const displayHeight = Math.round(state.nativeHeight * finalScale);
    
    // Set canvas display dimensions
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    // Calculate scale factor from native to display
    state.scale = canvas.width / state.nativeWidth;
    
    console.log('Canvas sizing:');
    console.log('  Native resolution:', state.nativeWidth, 'x', state.nativeHeight);
    console.log('  Display size:', canvas.width, 'x', canvas.height);
    console.log('  Scale factor:', state.scale.toFixed(3));
    console.log('  Available space:', maxWidth, 'x', maxHeight);
    console.log('  Scale by width:', scaleByWidth.toFixed(3), 'Scale by height:', scaleByHeight.toFixed(3));
    console.log('  Final scale (min):', finalScale.toFixed(3));
    console.log('  Viewport:', viewportWidth, 'x', viewportHeight);
  }

  // Helpers
  function colorLuminance(hex, lum){
    // lighten/darken
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    let rgb="#";
    for (let i=0; i<3; i++){
      let c = parseInt(hex.substr(i*2,2),16);
      c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255));
      rgb += ("00"+c.toString(16)).slice(-2);
    }
    return rgb;
  }

  function loadImageFromFile(input, cb){
    const f = input.files && input.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); cb(img); };
    img.src = url;
  }

  function fitText({text, maxWidth, maxSize, minSize=24, family, weight='900', letter=0}){
    let size = maxSize;
    ctx.font = `${weight} ${size}px '${family}', system-ui`;
    let w = measureWithTracking(text, letter);
    while (w > maxWidth && size > minSize){
      size -= 2;
      ctx.font = `${weight} ${size}px '${family}', system-ui`;
      w = measureWithTracking(text, letter);
    }
    return {size, width:w};
  }
  function measureWithTracking(text, letter){
    if(!letter) return ctx.measureText(text).width;
    let w = 0; const m = ctx.measureText(text);
    // naive: base width + tracking*(len-1)
    w = m.width + letter * Math.max(0, (text?.length||0)-1);
    return w;
  }
  function drawTrackedText(text, x, y, letter){
    if(!letter){ ctx.fillText(text, x, y); return; }
    // draw char by char with tracking
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + letter;
    }
  }

  function wrapLines(text, maxWidth, context){
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for(const w of words){
      const test = line ? line + ' ' + w : w;
      if(context.measureText(test).width > maxWidth && line){
        lines.push(line); line = w;
      }else line = test;
    }
    if(line) lines.push(line);
    return lines;
  }

  // Export at native resolution
  function exportAtNativeResolution() {
    if (!state.nativeWidth || !state.nativeHeight) {
      console.warn('No native resolution available for export');
      return null;
    }

    // Create a temporary canvas at native resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = state.nativeWidth;
    exportCanvas.height = state.nativeHeight;
    const exportCtx = exportCanvas.getContext('2d');

    // Store original values
    const originalCanvas = canvas;
    const originalCtx = ctx;
    const originalScale = state.scale;

    try {
      // Temporarily use export canvas and native scale
      // We'll modify the render function to accept parameters
      state.scale = 1; // Native scale
      
      // Call render with the export context
      renderToContext(exportCtx, exportCanvas);
      
      // Return the data URL
      return exportCanvas.toDataURL('image/png');
    } finally {
      // Restore original scale
      state.scale = originalScale;
    }
  }

  // Helper function to render to any context/canvas
  function renderToContext(renderCtx, targetCanvas) {
    // Always work in native units, then scale for display
    const nativeW = state.nativeWidth;
    const nativeH = state.nativeHeight;
    const scale = state.scale;

    // Target dimensions
    const W = targetCanvas.width;
    const H = targetCanvas.height;

    // Guard against invalid dimensions
    if (W <= 0 || H <= 0 || nativeW <= 0 || nativeH <= 0 || scale <= 0) {
      console.warn('Invalid dimensions:', {W, H, nativeW, nativeH, scale});
      return;
    }

    console.log('Rendering to context at scale:', scale.toFixed(3), 'Target:', W, 'x', H, 'Native:', nativeW, 'x', nativeH);

    const tint = el('tint').value;
    // Hard-coded values for better defaults
    const tintStrength = 0.3;  // 30%
    const imgOpacity = 0.8;    // 80%
    const blend = 'multiply';   // multiply blend mode
    const ink = '#ffffff';     // Always white text

    // BACKGROUND TINT
    renderCtx.save();
    renderCtx.fillStyle = tint;
    renderCtx.fillRect(0,0,W,H);

    // draw image to fill entire canvas
    if(state.img){
      console.log('Drawing image with opacity:', imgOpacity, 'blend:', blend);
      
      renderCtx.globalAlpha = imgOpacity;
      renderCtx.globalCompositeOperation = blend;
      // Draw image to fill entire canvas (positioned at top-left, scaled to fill)
      renderCtx.drawImage(state.img, 0, 0, W, H);

      renderCtx.globalAlpha = 1;
      renderCtx.globalCompositeOperation = 'source-over';
    } else {
      console.log('No image to draw');
    }

    // semi‑opaque tint wash over everything to get that solid brand colour
    renderCtx.globalAlpha = tintStrength;
    renderCtx.fillStyle = tint;
    renderCtx.fillRect(0,0,W,H);
    renderCtx.globalAlpha = 1;

    // TEXT SETUP - All measurements in native units, then scaled
    const nativePad = Math.round(nativeW * 0.08);
    const pad = nativePad * scale;
    const colX = pad;
    const colW = (nativeW - nativePad*2) * scale;

    // Title
    const title1 = el('title1').value.trim();
    const title2 = el('title2').value.trim();
    // Hard-coded title styling values (in native units)
    const nativeTitleMax = 260;  // Good max size for readability
    const titleMax = nativeTitleMax * scale;
    const track = -2 * scale;      // Slight negative tracking for better spacing

    // Load current chosen families
    const titleFamily = state.titleFont || 'TrueNo-Black';
    const bodyFamily  = state.bodyFont || 'TrueNo-Book';

    // Title 1
    let y = pad + 20 * scale;
    renderCtx.fillStyle = ink;
    if(title1){
      const f1 = fitTextForContext(renderCtx, {text:title1, maxWidth:colW, maxSize:titleMax, family:titleFamily, weight:'900', letter:track});
      renderCtx.font = `900 ${f1.size}px '${titleFamily}', system-ui`;
      renderCtx.textBaseline = 'top';
      drawTrackedTextForContext(renderCtx, title1, colX, y, track);
      y += f1.size * 0.95 + 8 * scale;
    }

    // Title 2 (extra large) - should stretch to fill width
    if(title2){
      // Make title2 as large as possible to fill the width
      const f2 = fitTextForContext(renderCtx, {text:title2, maxWidth:colW, maxSize:Math.round(titleMax*3), minSize:titleMax, family:titleFamily, weight:'900', letter:track});
      renderCtx.font = `900 ${f2.size}px '${titleFamily}', system-ui`;
      renderCtx.textBaseline = 'top';
      drawTrackedTextForContext(renderCtx, title2, colX, y, track);
      y += f2.size * 0.9 + 18 * scale;
    }

    // Subtitle
    const sub = el('subtitle').value.trim();
    if(sub){
      // Make subtitle stretch to fill width like it used to
      // Auto-calculate subtitle size to fit the full width (native units)
      const nativeBaseSize = 120; // Increased base size for better filling
      const nativeMinSize = 40;
      const baseSize = nativeBaseSize * scale;
      const minSize = nativeMinSize * scale;
      
      // Use fitText to make it fill the width
      const subFit = fitTextForContext(renderCtx, {text:sub, maxWidth:colW, maxSize:baseSize, minSize:minSize, family:bodyFamily, weight:'normal', letter:0});
      
      renderCtx.font = `normal ${subFit.size}px '${bodyFamily}', system-ui`;
      renderCtx.fillStyle = colorLuminance(ink, -0.06); // slightly dimmer than title
      renderCtx.textBaseline = 'alphabetic';
      
      // Add proper spacing after title (scaled)
      y += 48 * scale; // A touch more gap between title and subtitle
      renderCtx.fillText(sub, colX, y);
      y += subFit.size + 32 * scale; // Space after subtitle
    }

    // Author (halfway down, right-justified)
    const author = el('author').value.trim();
    if(author){
      // Hard-coded styling: 175pt (2.5x bigger), mixed case, right-justified (native units)
      const nativeAuthorSize = 175; // Increased from 70 to make it 2.5x bigger
      const authorSize = nativeAuthorSize * scale;
      const text = author; // Keep mixed case as entered
      
      renderCtx.font = `normal ${authorSize}px '${bodyFamily}', system-ui`;
      renderCtx.fillStyle = ink;
      renderCtx.textBaseline = 'alphabetic';
      
      // Position halfway down the page
      const ay = H / 2;
      
      // Right-justify the text
      const textWidth = renderCtx.measureText(text).width;
      const ax = W - pad - textWidth; // Right edge minus padding minus text width
      
      renderCtx.fillText(text, ax, ay);
    }

    // Logo (bottom-right)
    if(state.logo){
      // Fixed scale - 2.5x bigger than before (applied to native units)
      const logoScale = 1.0; // Increased from 0.40 to make it 2.5x bigger
      
      // Margin also 2.5x bigger (75px instead of 30px) - in native units
      const nativeMargin = 75; // Increased from 30 to make it 2.5x further from edges
      const margin = nativeMargin * scale; // Equal margin from bottom and right edges
      
      // Calculate logo dimensions (scaled)
      const lw = state.logo.width * logoScale * scale;
      const lh = state.logo.height * logoScale * scale;
      
      // Position at bottom-right with equal margins
      const lx = W - margin - lw; // Right edge minus margin minus logo width
      const ly = H - margin - lh; // Bottom edge minus margin minus logo height
      
      // Draw logo directly (no background pill)
      renderCtx.drawImage(state.logo, lx, ly, lw, lh);
    }

    renderCtx.restore();
  }

  // Updated render function to use the new context-based rendering
  function render(){
    renderToContext(ctx, canvas);
  }

  // Helper functions for context-based rendering
  function fitTextForContext(renderCtx, {text, maxWidth, maxSize, minSize=24, family, weight='900', letter=0}){
    let size = maxSize;
    renderCtx.font = `${weight} ${size}px '${family}', system-ui`;
    let w = measureWithTrackingForContext(renderCtx, text, letter);
    while (w > maxWidth && size > minSize){
      size -= 2;
      renderCtx.font = `${weight} ${size}px '${family}', system-ui`;
      w = measureWithTrackingForContext(renderCtx, text, letter);
    }
    return {size, width:w};
  }
  
  function measureWithTrackingForContext(renderCtx, text, letter){
    if(!letter) return renderCtx.measureText(text).width;
    let w = 0; const m = renderCtx.measureText(text);
    // naive: base width + tracking*(len-1)
    w = m.width + letter * Math.max(0, (text?.length||0)-1);
    return w;
  }
  
  function drawTrackedTextForContext(renderCtx, text, x, y, letter){
    if(!letter){ renderCtx.fillText(text, x, y); return; }
    // draw char by char with tracking
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      renderCtx.fillText(ch, x, y);
      x += renderCtx.measureText(ch).width + letter;
    }
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // EVENTS
  ['tint','title1','title2','subtitle','author']
    .forEach(id=> el(id).addEventListener('input', render));

  // Window resize handler for responsive canvas
  window.addEventListener('resize', () => {
    if (state.img) {
      setCanvasSize();
      render();
    }
  });

  // Download
  el('downloadPng').addEventListener('click', ()=>{
    const exportDataUrl = exportAtNativeResolution();
    if (exportDataUrl) {
      const link = document.createElement('a');
      link.download = 'perl-school-cover.png';
      link.href = exportDataUrl;
      link.click();
    } else {
      console.error('Failed to export at native resolution');
    }
  });

  // Presets (JSON)
  el('savePreset').addEventListener('click', ()=>{
    const data = {
      tint:el('tint').value,
      title1:el('title1').value, title2:el('title2').value,
      subtitle:el('subtitle').value,
      author:el('author').value
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.download='cover-preset.json';
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  });

  el('loadPreset').addEventListener('click', ()=>{
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='application/json';
    inp.onchange = () => {
      const f = inp.files?.[0]; if(!f) return;
      const r = new FileReader();
      r.onload = () => {
        try{
          const d = JSON.parse(r.result);
          const set = (id,v)=>{ if(el(id)) el(id).value = v };
          Object.entries(d).forEach(([k,v])=> set(k,v));
          render();
        }catch(e){ alert('Invalid preset'); }
      };
      r.readAsText(f);
    };
    inp.click();
  });

  // Initialize with default image, logo, and fonts
  // Set initial canvas size in case image loading fails
  canvas.width = 1600;
  canvas.height = 2560;
  loadFonts();
  loadDefaultImage();
  loadDefaultLogo();
})();