document.addEventListener("DOMContentLoaded", () => {
  // ==========================
  // Elementos da interface
  // ==========================
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const canvas = document.getElementById('tela');
  const coordDisplay = document.getElementById('coordenadas-display');
  const limparBtns = document.querySelectorAll('.limpar-btn');

  // Abas
  const tabsContainer = document.querySelector('.tabs');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Algoritmos
  const bresenhamBtn = document.getElementById('bresenham-btn');
  const circleBtn = document.getElementById('circle-btn');
  const bezierBtn = document.getElementById('bezier-btn');
  const polygonBtn = document.getElementById('polygon-btn');
  const lineClipBtn = document.getElementById('line-clip-btn');
  const radiusInput = document.getElementById('radius-input');
  const controlPointsInput = document.getElementById('control-points-input');
  const vertexCountInput = document.getElementById('vertex-count-input');

  // Projeções
  const cubeSizeInput = document.getElementById('cube-size-input');
  const orthoProjBtn = document.getElementById('ortho-proj-btn');
  const perspProjBtn = document.getElementById('persp-proj-btn');

  // Formas
  const shapeCircleBtn = document.getElementById('shape-circle-btn');
  const shapeCurveBtn = document.getElementById('shape-curve-btn');
  const shapePolygonBtn = document.getElementById('shape-polygon-btn');
  const shapeComplexPolygonBtn = document.getElementById('shape-complex-polygon-btn');

  // Preenchimento
  const recursiveFillBtn = document.getElementById('recursive-fill-btn');
  const scanlineFillBtn = document.getElementById('scanline-fill-btn');

  // Transformações
  const translateBtn = document.getElementById('translate-btn');
  const translateXInput = document.getElementById('translate-x-input');
  const translateYInput = document.getElementById('translate-y-input');
  const rotateBtn = document.getElementById('rotate-btn');
  const angleInput = document.getElementById('angle-input');
  const scaleBtn = document.getElementById('scale-btn');
  const scaleXInput = document.getElementById('scale-x-input');
  const scaleYInput = document.getElementById('scale-y-input');

  // Troca de abas
  tabsContainer.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    const targetTab = e.target.dataset.tab;
    tabButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    tabContents.forEach(content => content.classList.toggle('active', content.id === targetTab));
  });

orthoProjBtn.addEventListener('click', () => {
  currentMode = 'orthoSelectCenter';
  updateCoordinatesDisplay();
});

perspProjBtn.addEventListener('click', () => {
  currentMode = 'perspSelectCenter';
  updateCoordinatesDisplay();
});

  // ==========================
  // Canvas & Mundo lógico
  // ==========================
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Ajusta para o tamanho exibido
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  // Sistema lógico: altura fixa (100), largura proporcional
  const logicalHeight = 100;
  const logicalWidth = (canvas.width / canvas.height) * logicalHeight;

  const world = {
    xMin: -logicalWidth / 2,
    xMax:  logicalWidth / 2,
    yMin: -logicalHeight / 2,
    yMax:  logicalHeight / 2,
  };

  // ==========================
  // Estado
  // ==========================
  let selectionPoints = [];      // pontos temporários (cliques)
  let specialPoint = null;       // pivô/ponto fixo visual
  let drawnObjects = [];         // objetos rasterizados (cada um com .pixels)
  let currentMode = 'default';   // controla o fluxo de seleção
  let requiredPoints = 0;        // p/ polígono manual

  // ==========================
  // Utilitários de desenho
  // ==========================

  /** setupCoordinateSystem()
   * Configura a transformação do canvas para um plano cartesiano centralizado
   * e com eixo Y positivo para cima (escala em Y é negativa).
   */
  function setupCoordinateSystem(){
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(canvas.width/logicalWidth, -canvas.height/logicalHeight);
  }

  /** drawLogicalGrid(gridSize)
   * Desenha a grade leve e os eixos X/Y no espaço lógico.
   */
  function drawLogicalGrid(gridSize){
    ctx.beginPath();
    ctx.strokeStyle = '#e9e9e9';
    ctx.lineWidth = 0.1;

    for(let x=gridSize; x<world.xMax; x+=gridSize){ ctx.moveTo(x, world.yMin); ctx.lineTo(x, world.yMax); }
    for(let x=-gridSize; x>world.xMin; x-=gridSize){ ctx.moveTo(x, world.yMin); ctx.lineTo(x, world.yMax); }
    for(let y=gridSize; y<world.yMax; y+=gridSize){ ctx.moveTo(world.xMin, y); ctx.lineTo(world.xMax, y); }
    for(let y=-gridSize; y>world.yMin; y-=gridSize){ ctx.moveTo(world.xMin, y); ctx.lineTo(world.xMax, y); }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = 'var(--axis)';
    ctx.lineWidth = 0.2;
    ctx.moveTo(world.xMin, 0); ctx.lineTo(world.xMax, 0);
    ctx.moveTo(0, world.yMin); ctx.lineTo(0, world.yMax);
    ctx.stroke();
  }

  /** bresenhamLine(p1,p2)
   * Rasteriza uma reta usando Bresenham e retorna os pixels {x,y}.
   */
  function bresenhamLine(p1, p2){
    let { x:x1, y:y1 } = p1;
    let { x:x2, y:y2 } = p2;
    const points = [];
    x1=Math.round(x1); y1=Math.round(y1); x2=Math.round(x2); y2=Math.round(y2);
    let dx=Math.abs(x2-x1), dy=Math.abs(y2-y1);
    let sx=(x1<x2)?1:-1, sy=(y1<y2)?1:-1;
    let err=dx-dy;
    while(true){
      points.push({x:x1,y:y1});
      if(x1===x2 && y1===y2) break;
      const e2 = 2*err;
      if(e2>-dy){ err-=dy; x1+=sx; }
      if(e2< dx){ err+=dx; y1+=sy; }
    }
    return points;
  }

  /** midpointCircle(xc,yc,r)
   * Rasteriza círculo (algoritmo do ponto médio) e retorna pixels.
   */
  function midpointCircle(xc, yc, radius){
    const points=[];
    let x=Math.round(radius), y=0, err=1-x;
    const plot=(cx,cy,px,py)=>{
      points.push(
        {x:cx+px,y:cy+py},{x:cx-px,y:cy+py},{x:cx+px,y:cy-py},{x:cx-px,y:cy-py},
        {x:cx+py,y:cy+px},{x:cx-py,y:cy+px},{x:cx+py,y:cy-px},{x:cx-py,y:cy-px}
      );
    };
    plot(xc,yc,x,y);
    while(x>y){
      y++;
      if(err<=0){ err+=2*y+1; }
      else{ x--; err+=2*(y-x)+1; }
      plot(xc,yc,x,y);
    }
    return points;
  }

  /** cubicBezier(p0,p1,p2,p3,t)
   * Avalia uma Bézier cúbica no parâmetro t e retorna ponto inteiro.
   */
  function cubicBezier(p0,p1,p2,p3,t){
    const omt=1-t;
    const x = omt*omt*omt*p0.x + 3*omt*omt*t*p1.x + 3*omt*t*t*p2.x + t*t*t*p3.x;
    const y = omt*omt*omt*p0.y + 3*omt*omt*t*p1.y + 3*omt*t*t*p2.y + t*t*t*p3.y;
    return { x:Math.round(x), y:Math.round(y) };
  }

  /** rasterizePolyline(points)
   * Conecta pontos sequenciais usando Bresenham.
   */
  function rasterizePolyline(points){
    const all=[];
    for(let i=0;i<points.length-1;i++){
      all.push(...bresenhamLine(points[i], points[i+1]));
    }
    return all;
  }

  /** rasterizePolygon(vertices)
   * Conecta os vértices em ciclo (contorno do polígono).
   */
  function rasterizePolygon(vertices){
    const all=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i];
      const b=vertices[(i+1)%vertices.length];
      all.push(...bresenhamLine(a,b));
    }
    return all;
  }

  /** isPointInPolygon(pt, vertices)
   * Teste winding number para ponto em polígono.
   */
  function isPointInPolygon(point, vertices){
    if(!vertices || vertices.length<3) return false;
    let w=0;
    for(let i=0;i<vertices.length;i++){
      const p1=vertices[i], p2=vertices[(i+1)%vertices.length];
      if(p1.y<=point.y){
        if(p2.y>point.y && ((p2.x-p1.x)*(point.y-p1.y)-(p2.y-p1.y)*(point.x-p1.x))>0) w++;
      }else if(p2.y<=point.y && ((p2.x-p1.x)*(point.y-p1.y)-(p2.y-p1.y)*(point.x-p1.x))<0) w--;
    }
    return w!==0;
  }

  /** isPointInCircle(pt, circle)
   * Teste ponto em círculo por distância.
   */
  function isPointInCircle(point, circle){
    return Math.hypot(point.x-circle.center.x, point.y-circle.center.y) < circle.radius;
  }

  // ---- Recorte (Cohen–Sutherland)
  const INSIDE=0, LEFT=1, RIGHT=2, BOTTOM=4, TOP=8;

  /** computeCode(x,y,win)
   * Código de região para Cohen–Sutherland.
   */
  function computeCode(x,y,clipWindow){
    let code=INSIDE;
    if(x<clipWindow.xMin) code|=LEFT; else if(x>clipWindow.xMax) code|=RIGHT;
    if(y<clipWindow.yMin) code|=BOTTOM; else if(y>clipWindow.yMax) code|=TOP;
    return code;
  }

  /** cohenSutherlandClip(p1,p2,win)
   * Recorta um segmento conforme a janela; retorna 2 pontos ou null.
   */
  function cohenSutherlandClip(p1,p2,clipWindow){
    let x1=p1.x, y1=p1.y, x2=p2.x, y2=p2.y;
    let c1=computeCode(x1,y1,clipWindow), c2=computeCode(x2,y2,clipWindow);
    while(true){
      if(!(c1|c2)) return [{x:x1,y:y1},{x:x2,y:y2}];
      if(c1&c2) return null;
      let x,y;
      const out = c1 || c2;
      if(out & TOP){ x = x1 + (x2-x1)*(clipWindow.yMax - y1)/(y2 - y1); y = clipWindow.yMax; }
      else if(out & BOTTOM){ x = x1 + (x2-x1)*(clipWindow.yMin - y1)/(y2 - y1); y = clipWindow.yMin; }
      else if(out & RIGHT){ y = y1 + (y2-y1)*(clipWindow.xMax - x1)/(x2 - x1); x = clipWindow.xMax; }
      else { /* LEFT */     y = y1 + (y2-y1)*(clipWindow.xMin - x1)/(x2 - x1); x = clipWindow.xMin; }
      if(out===c1){ x1=x; y1=y; c1=computeCode(x1,y1,clipWindow); }
      else{ x2=x; y2=y; c2=computeCode(x2,y2,clipWindow); }
    }
  }

  /** redrawCanvas()
   * Redesenha grade + todos os objetos + feedback de seleção.
   */
  function redrawCanvas(){
    setupCoordinateSystem();
    drawLogicalGrid(10);

    drawnObjects.forEach(obj=>{
      ctx.fillStyle = obj.color || 'black';
      obj.pixels.forEach(px => ctx.fillRect(px.x, px.y, 1, 1));
    });

    // pontos selecionados (vermelho)
    ctx.fillStyle='red';
    selectionPoints.forEach(p => ctx.fillRect(p.x-0.5, p.y-0.5, 2, 2));

    // pivô/pto fixo (ciano)
    if(specialPoint){
      ctx.fillStyle='var(--pivot-color)';
      ctx.fillRect(specialPoint.x-1, specialPoint.y-1, 3, 3);
    }
  }

  // Mensagens temporárias
  let messageTimeout;
  function showTemporaryMessage(message, isError){
    clearTimeout(messageTimeout);
    coordDisplay.innerHTML = `<p>${message}</p>`;
    if(isError) coordDisplay.classList.add('coord-error');
    messageTimeout = setTimeout(()=>{
      coordDisplay.classList.remove('coord-error');
      updateCoordinatesDisplay();
    }, 3000);
  }

  /** updateCoordinatesDisplay()
   * Atualiza instruções conforme o modo e exibe pontos escolhidos.
   */
  function updateCoordinatesDisplay(){
    let html = '';
    if(currentMode==='orthoSelectCenter' || currentMode==='perspSelectCenter'){
      html = `<p>Clique para definir o centro da face do cubo.</p>`;
    } else if(currentMode==='rotationPivotSelect'){
      html = `<p>Clique perto de um vértice para ser o pivô.</p>`;
    } else if(currentMode==='scaleFixedPointSelect'){
      html = `<p>Clique perto de um vértice para ser o ponto fixo.</p>`;
    } else if(currentMode==='clippingWindowSelect'){
      html = `<p>Clique em 2 pontos para definir a janela de recorte.</p>`;
    } else if(currentMode==='recursiveFillSelect' || currentMode==='scanlineFillSelect'){
      html = `<p>Clique dentro de uma forma para preencher.</p>`;
    } else if(selectionPoints.length===0 && currentMode==='default'){
      html = `<p>Nenhum ponto selecionado.</p>`;
    } else if(currentMode==='polygon'){
      html += `<p>Modo Polígono: Selecione ${requiredPoints - selectionPoints.length} de ${requiredPoints} ponto(s).</p>`;
      for(let i=0;i<requiredPoints;i++){
        const p = selectionPoints[i];
        html += p
          ? `<p>Ponto ${i+1}: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})</p>`
          : `<p>Ponto ${i+1}: (___, ___)</p>`;
      }
    } else {
      selectionPoints.forEach((p,i)=> html += `<p>Ponto ${i+1}: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})</p>`);
    }
    coordDisplay.innerHTML = html;
  }

  // ==========================
  // Preenchimentos
  // ==========================

  /** boundaryFill(x,y)
   * Preenchimento por fronteira (4 vizinhos) usando pilha.
   */
  function boundaryFill(startX, startY){
    const pixels=[];
    const stack=[{x:Math.round(startX), y:Math.round(startY)}];
    const visited=new Set();
    const boundary=new Set();
    drawnObjects.forEach(obj => obj.pixels?.forEach(p => boundary.add(`${p.x},${p.y}`)));

    while(stack.length){
      const p=stack.pop();
      const key=`${p.x},${p.y}`;
      if(visited.has(key) || boundary.has(key)) continue;

      visited.add(key);
      pixels.push(p);

      stack.push({x:p.x+1,y:p.y});
      stack.push({x:p.x-1,y:p.y});
      stack.push({x:p.x,y:p.y+1});
      stack.push({x:p.x,y:p.y-1});
    }
    return pixels;
  }

  /** scanlineFill(vertices)
   * Preenchimento por varredura (winding) em polígonos.
   */
  function scanlineFill(vertices){
    const pixels=[];
    if(vertices.length<3) return pixels;
    let yMin=Infinity, yMax=-Infinity;
    vertices.forEach(v => { yMin=Math.min(yMin,v.y); yMax=Math.max(yMax,v.y); });

    for(let y=Math.round(yMin); y<=Math.round(yMax); y++){
      const inter=[];
      for(let i=0;i<vertices.length;i++){
        const p1=vertices[i], p2=vertices[(i+1)%vertices.length];
        if(p1.y===p2.y) continue;
        if(Math.min(p1.y,p2.y)<=y && Math.max(p1.y,p2.y)>y){
          const x = (y-p1.y)*(p2.x-p1.x)/(p2.y-p1.y) + p1.x;
          const dir = p1.y < p2.y ? 1 : -1;
          inter.push({x, direction:dir});
        }
      }
      inter.sort((a,b)=>a.x-b.x);
      let w=0;
      for(let i=0;i<inter.length;i++){
        if(w!==0 && i>0){
          for(let x=Math.round(inter[i-1].x); x<Math.round(inter[i].x); x++){
            pixels.push({x,y});
          }
        }
        w += inter[i].direction;
      }
    }
    return pixels;
  }

  /** scanlineFillCircle(circle)
   * Varredura horizontal para preencher círculos.
   */
  function scanlineFillCircle(circle){
    const pixels=[];
    const {center, radius} = circle;
    const yStart=Math.round(center.y - radius);
    const yEnd  =Math.round(center.y + radius);
    for(let y=yStart; y<=yEnd; y++){
      const dy=y-center.y;
      const dx=Math.sqrt(radius*radius - dy*dy);
      const xs=Math.round(center.x - dx);
      const xe=Math.round(center.x + dx);
      for(let x=xs; x<=xe; x++) pixels.push({x,y});
    }
    return pixels;
  }

  /** handleFillClick(point, mode)
   * Decide alvo (polígono/círculo) e aplica o algoritmo solicitado.
   */
  function handleFillClick(point, fillMode){
    const shape = [...drawnObjects].reverse().find(obj=>{
      if(obj.type==='polygon') return isPointInPolygon(point, obj.vertices);
      if(obj.type==='circle')  return isPointInCircle(point, obj);
      return false;
    });
    if(!shape){ showTemporaryMessage('Nenhuma forma encontrada no local do clique.', true); return; }

    const pixels = (fillMode==='scanline')
      ? (shape.type==='polygon' ? scanlineFill(shape.vertices) : scanlineFillCircle(shape))
      : boundaryFill(point.x, point.y);

    drawnObjects.push({ type:'fill', pixels, color:'var(--fill-color)' });
    currentMode='default';
    redrawCanvas();
  }

  // ==========================
  // Eventos de clique no canvas
  // ==========================

  /** toLogicalPoint(event)
   * Converte coordenadas da tela para o sistema lógico.
   */
  function toLogicalPoint(event){
    const rect = canvas.getBoundingClientRect();
    const lx = (event.clientX - rect.left - canvas.width/2) / (canvas.width/logicalWidth);
    const ly = (event.clientY - rect.top  - canvas.height/2) / (-canvas.height/logicalHeight);
    return { x: lx, y: ly };
  }

  canvas.addEventListener('click', (event)=>{
    const lp = toLogicalPoint(event);
    const newPoint = { x: Math.round(lp.x), y: Math.round(lp.y) };

    // ======= MODO PROJEÇÃO =======
    if(currentMode==='orthoSelectCenter' || currentMode==='perspSelectCenter'){
      const half = (parseFloat(cubeSizeInput.value)||20)/2;
      const faceCenter = newPoint;

      // Face frontal (quadrado centrado no ponto)
      const front = [
        {x:faceCenter.x - half, y:faceCenter.y - half},
        {x:faceCenter.x + half, y:faceCenter.y - half},
        {x:faceCenter.x + half, y:faceCenter.y + half},
        {x:faceCenter.x - half, y:faceCenter.y + half},
      ];

      if(currentMode==='orthoSelectCenter'){
        // Projeção Ortogonal: apenas a face frontal
        drawnObjects.push({ type:'polygon', vertices:front, pixels:rasterizePolygon(front) });
      } else {
        // “Perspectiva” oblíqua: face traseira deslocada + arestas de ligação
        const offset = half * 0.7;           // fator ~45° (ajustável)
        const back = front.map(v => ({ x:v.x + offset, y:v.y + offset }));

        const px=[];
        px.push(...rasterizePolygon(front));
        px.push(...rasterizePolygon(back));
        for(let i=0;i<4;i++){
          px.push(...bresenhamLine(front[i], back[i]));
        }
        drawnObjects.push({ type:'projection', pixels:px });
      }

      currentMode='default';
      selectionPoints=[];
      redrawCanvas();
      updateCoordinatesDisplay();
      return;
    }

    // ======= OUTROS MODOS =======
    if(currentMode==='rotationPivotSelect' || currentMode==='scaleFixedPointSelect'){
      // Seleciona vértice mais próximo como pivô/ponto fixo
      let closest = { vertex:null, polygonIndex:-1, distance:Infinity };
      drawnObjects.forEach((obj, idx)=>{
        if(obj.type==='polygon'){
          obj.vertices.forEach(v=>{
            const d=Math.hypot(newPoint.x - v.x, newPoint.y - v.y);
            if(d < closest.distance){
              closest = { vertex:v, polygonIndex:idx, distance:d };
            }
          });
        }
      });
      const TH=5;
      if(closest.polygonIndex===-1 || closest.distance>TH){
        showTemporaryMessage('Nenhum vértice de polígono próximo encontrado.', true);
        currentMode='default';
        return;
      }

      const pivot = closest.vertex;
      const poly = drawnObjects[closest.polygonIndex];
      let newVertices;

      if(currentMode==='rotationPivotSelect'){
        const ang = parseFloat(angleInput.value) * Math.PI/180;
        if(isNaN(ang)){ showTemporaryMessage('Ângulo inválido.', true); return; }
        newVertices = poly.vertices.map(v=>{
          const tx=v.x - pivot.x, ty=v.y - pivot.y;
          const rx =  tx*Math.cos(ang) - ty*Math.sin(ang);
          const ry =  tx*Math.sin(ang) + ty*Math.cos(ang);
          return { x:rx + pivot.x, y:ry + pivot.y };
        });
      } else { // scaleFixedPointSelect
        const sx=parseFloat(scaleXInput.value), sy=parseFloat(scaleYInput.value);
        if(isNaN(sx)||isNaN(sy)){ showTemporaryMessage('Fatores de escala inválidos.', true); return; }
        newVertices = poly.vertices.map(v=>{
          const tx=v.x - pivot.x, ty=v.y - pivot.y;
          return { x: tx*sx + pivot.x, y: ty*sy + pivot.y };
        });
      }

      drawnObjects[closest.polygonIndex] = { ...poly, vertices:newVertices, pixels:rasterizePolygon(newVertices) };
      specialPoint = pivot;
      currentMode='default';
      redrawCanvas();
      updateCoordinatesDisplay();
      return;
    }

    if(currentMode==='clippingWindowSelect'){
      // Seleção de 2 cantos da janela de recorte
      selectionPoints.push(newPoint);
      if(selectionPoints.length===2){
        const [p1,p2]=selectionPoints;
        const win = { xMin:Math.min(p1.x,p2.x), xMax:Math.max(p1.x,p2.x), yMin:Math.min(p1.y,p2.y), yMax:Math.max(p1.y,p2.y) };
        const windowPoly = [
          {x:win.xMin, y:win.yMax}, {x:win.xMax, y:win.yMax},
          {x:win.xMax, y:win.yMin}, {x:win.xMin, y:win.yMin}
        ];
        const newObjs=[];
        drawnObjects.forEach(obj=>{
          if(obj.type==='line'){
            const clipped = cohenSutherlandClip(obj.p1, obj.p2, win);
            if(clipped) newObjs.push({ ...obj, p1:clipped[0], p2:clipped[1], pixels:bresenhamLine(clipped[0],clipped[1]) });
          } else if(obj.pixels){
            const kept = obj.pixels.filter(p => p.x>=win.xMin && p.x<=win.xMax && p.y>=win.yMin && p.y<=win.yMax);
            if(kept.length) newObjs.push({ ...obj, pixels:kept });
          }
        });
        drawnObjects = newObjs;
        drawnObjects.push({ type:'clippingWindow', vertices:windowPoly, pixels:rasterizePolygon(windowPoly), color:'var(--clip-color)' });
        selectionPoints=[]; currentMode='default';
        redrawCanvas();
        updateCoordinatesDisplay();
      }
      return;
    }

    if(currentMode==='recursiveFillSelect'){
      handleFillClick(newPoint, 'recursive');
      return;
    }
    if(currentMode==='scanlineFillSelect'){
      handleFillClick(newPoint, 'scanline');
      return;
    }

    if(currentMode==='polygon'){
      if(selectionPoints.length < requiredPoints) selectionPoints.push(newPoint);
      if(selectionPoints.length === requiredPoints){
        drawnObjects.push({ type:'polygon', vertices:[...selectionPoints], pixels:rasterizePolygon(selectionPoints) });
        selectionPoints=[]; currentMode='default';
      }
      redrawCanvas(); updateCoordinatesDisplay();
      return;
    }

    // Modo padrão: apenas guardar até 2 cliques como feedback
    if(selectionPoints.length>=2) selectionPoints=[];
    selectionPoints.push(newPoint);
    redrawCanvas(); updateCoordinatesDisplay();

    // Atualiza cursor contextual
    canvasWrapper.className='canvas-wrap';
    if(currentMode.includes('Fill'))  canvasWrapper.classList.add('fill-mode');
    if(currentMode.includes('Clip'))  canvasWrapper.classList.add('clip-mode');
    if(currentMode.includes('Pivot') || currentMode.includes('FixedPoint')) canvasWrapper.classList.add('pivot-mode');
  });

  // ==========================
  // Botões (Algoritmos)
  // ==========================

  /** Desenha reta com 2 cliques já escolhidos. */
  bresenhamBtn.addEventListener('click', ()=>{
    currentMode='default';
    if(selectionPoints.length===2){
      const [p1,p2]=selectionPoints;
      drawnObjects.push({ type:'line', p1, p2, pixels:bresenhamLine(p1,p2) });
      selectionPoints=[];
      redrawCanvas(); updateCoordinatesDisplay();
    } else {
      alert('Por favor, selecione 2 pontos no canvas para a reta.');
    }
  });

  /** Desenha círculo: (centro + raio) OU (centro + ponto da borda). */
  circleBtn.addEventListener('click', ()=>{
    currentMode='default';
    const r = parseInt(radiusInput.value,10);
    if(!isNaN(r) && r>0){
      if(selectionPoints.length>=1){
        const center = selectionPoints[0];
        drawnObjects.push({ type:'circle', center, radius:r, pixels:midpointCircle(center.x, center.y, r) });
        selectionPoints=[]; radiusInput.value=''; redrawCanvas(); updateCoordinatesDisplay();
      } else {
        alert('Por favor, selecione 1 ponto no canvas para ser o centro.');
      }
      return;
    }
    if(selectionPoints.length===2){
      const [center, edge] = selectionPoints;
      const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
      drawnObjects.push({ type:'circle', center, radius, pixels:midpointCircle(center.x, center.y, radius) });
      selectionPoints=[]; redrawCanvas(); updateCoordinatesDisplay();
    } else {
      alert('Para desenhar o círculo, use:\n- 1 ponto (centro) + raio no campo, OU\n- 2 pontos (centro e borda) com o campo de raio vazio.');
    }
  });

  /** Desenha curva Bézier a partir de 2 pontos e 1–2 controles. */
  bezierBtn.addEventListener('click', ()=>{
    currentMode='default';
    if(selectionPoints.length!==2){ alert('Selecione 2 pontos (INÍCIO e FIM) da curva.'); return; }
    const txt = controlPointsInput.value.trim();
    if(!txt){ controlPointsInput.classList.add('input-error'); return; }

    const cps = txt.split(';')
      .map(s => s.trim().split(','))
      .filter(p => p.length===2)
      .map(([x,y]) => ({ x:parseInt(x,10), y:parseInt(y,10) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y));

    if(cps.length===0 || cps.length>2){ controlPointsInput.classList.add('input-error'); alert('Insira 1 ou 2 pontos de controle válidos.'); return; }

    const [p0,p3] = selectionPoints;
    const p1 = cps[0];
    const p2 = cps.length>1 ? cps[1] : p1;

    const curve = Array.from({length:101}, (_,i)=> cubicBezier(p0,p1,p2,p3, i/100));
    drawnObjects.push({ type:'bezier', pixels:rasterizePolyline(curve) });
    selectionPoints=[]; controlPointsInput.value=''; redrawCanvas(); updateCoordinatesDisplay();
  });

  /** Inicia modo Polígono (seleciona vértices manualmente). */
  polygonBtn.addEventListener('click', ()=>{
    const n = parseInt(vertexCountInput.value,10);
    if(isNaN(n) || n<3){ vertexCountInput.classList.add('input-error'); return; }
    vertexCountInput.classList.remove('input-error');
    requiredPoints = n; currentMode='polygon'; selectionPoints=[];
    redrawCanvas(); updateCoordinatesDisplay();
  });

  // ==========================
  // Formas rápidas (atalhos)
  // ==========================
  shapeCircleBtn.addEventListener('click', ()=>{
    const center={x:0,y:0}, r=25;
    drawnObjects.push({ type:'circle', center, radius:r, pixels:midpointCircle(center.x, center.y, r) });
    redrawCanvas();
  });

  shapeCurveBtn.addEventListener('click', ()=>{
    const p0={x:-30,y:0}, p1={x:-15,y:30}, p2={x:15,y:30}, p3={x:30,y:0};
    const curve = Array.from({length:101},(_,i)=> cubicBezier(p0,p1,p2,p3, i/100));
    drawnObjects.push({ type:'bezier', pixels:rasterizePolyline(curve) });
    redrawCanvas();
  });

  shapePolygonBtn.addEventListener('click', ()=>{
    const r=25, sides=6;
    const vertices = Array.from({length:sides},(_,i)=>({
      x: Math.round(r*Math.cos(i*2*Math.PI/sides)),
      y: Math.round(r*Math.sin(i*2*Math.PI/sides))
    }));
    drawnObjects.push({ type:'polygon', vertices, pixels:rasterizePolygon(vertices) });
    redrawCanvas();
  });

  shapeComplexPolygonBtn.addEventListener('click', ()=>{
    // exemplo simples (mantido do seu código)
    const starVertices = [
      {x: 0, y: 30}, {x: 20, y: -25}, {x: -20, y: 10}, {x: 20, y: 10}, {x: -20, y: -25}
    ];
    drawnObjects.push({ type:'polygon', vertices:starVertices, pixels:rasterizePolygon(starVertices) });
    redrawCanvas();
  });

  // ==========================
  // Preenchimento & Recorte
  // ==========================
  recursiveFillBtn.addEventListener('click', ()=>{
    currentMode='recursiveFillSelect'; selectionPoints=[];
    updateCoordinatesDisplay(); canvasWrapper.classList.add('fill-mode');
  });
  scanlineFillBtn.addEventListener('click', ()=>{
    currentMode='scanlineFillSelect'; selectionPoints=[];
    updateCoordinatesDisplay(); canvasWrapper.classList.add('fill-mode');
  });

  lineClipBtn.addEventListener('click', ()=>{
    currentMode='clippingWindowSelect'; selectionPoints=[];
    updateCoordinatesDisplay();
  });

  // ==========================
  // Transformações
  // ==========================
  translateBtn.addEventListener('click', ()=>{
    const dx=parseFloat(translateXInput.value)||0;
    const dy=parseFloat(translateYInput.value)||0;
    const idx = drawnObjects.map(o=>o.type).lastIndexOf('polygon');
    if(idx===-1){ showTemporaryMessage('Nenhum polígono para transladar.', true); return; }
    const poly = drawnObjects[idx];
    const nv = poly.vertices.map(v=>({x:v.x+dx, y:v.y+dy}));
    drawnObjects[idx] = { ...poly, vertices:nv, pixels:rasterizePolygon(nv) };
    redrawCanvas();
  });

  rotateBtn.addEventListener('click', ()=>{
    currentMode='rotationPivotSelect';
    updateCoordinatesDisplay(); canvasWrapper.classList.add('pivot-mode');
  });

  scaleBtn.addEventListener('click', ()=>{
    currentMode='scaleFixedPointSelect';
    updateCoordinatesDisplay(); canvasWrapper.classList.add('pivot-mode');
  });

  // ==========================
  // Pequenos ajustes de UX
  // ==========================
  vertexCountInput?.addEventListener('input', ()=> vertexCountInput.classList.remove('input-error'));
  controlPointsInput?.addEventListener('input', ()=> controlPointsInput.classList.remove('input-error'));

  /** clearFunction()
   * Limpa estado, inputs e redesenha apenas a grade.
   */
  const clearFunction = ()=>{
    selectionPoints=[]; specialPoint=null; drawnObjects=[];
    currentMode='default';
    canvasWrapper.className='canvas-wrap';
    document.querySelectorAll('input[type=number], input[type=text]').forEach(inp=>{
      if(inp.id.startsWith('scale')) inp.value='1';
      else if(inp.id==='cube-size-input') inp.value='20';
      else inp.value='';
    });
    redrawCanvas(); updateCoordinatesDisplay();
  };
  limparBtns.forEach(btn => btn.addEventListener('click', clearFunction));

  // Inicializa
  redrawCanvas();
  updateCoordinatesDisplay();
});
