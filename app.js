/* -------------------------------------------------------------
   TAURO IO - Academic Operations Research Solver Suite
   ------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initDashboardTabs();
  initBackgroundParticles();
  
  // Initialize dynamic forms
  initGraphicalForm();
  initSimplexForm();
  initBigMForm();
  initHungarianForm();
  initTransportForm();
  initMarkovForm();
  
  // Bind Solver buttons
  document.getElementById('btn-solve-graphical').addEventListener('click', solveGraphicalModel);
  document.getElementById('btn-solve-simplex').addEventListener('click', solveSimplexModel);
  document.getElementById('btn-solve-bigm').addEventListener('click', solveBigMModel);
  document.getElementById('btn-solve-hungarian').addEventListener('click', solveHungarianModel);
  document.getElementById('btn-solve-transport').addEventListener('click', solveTransportModel);
  document.getElementById('btn-calculate-eoq').addEventListener('click', solveEoqModel);
  document.getElementById('btn-solve-markov').addEventListener('click', solveMarkovModel);

  // Auto solve once on startup
  solveGraphicalModel();
  solveEoqModel();
  solveMarkovModel();
  solveSimplexModel();
  solveBigMModel();

  // Redraw charts on window resize to ensure responsiveness
  window.addEventListener('resize', () => {
    const activeTab = document.querySelector('.dash-preview-tab.active');
    if (activeTab) {
      const target = activeTab.getAttribute('data-tab');
      if (target === 'graphical') {
        solveGraphicalModel();
      } else if (target === 'simplex') {
        const selectVars = document.getElementById('simplex-vars-count');
        if (selectVars && parseInt(selectVars.value) === 2) {
          solveSimplexModel();
        }
      } else if (target === 'bigm') {
        const selectVars = document.getElementById('bigm-vars-count');
        if (selectVars && parseInt(selectVars.value) === 2) {
          solveBigMModel();
        }
      } else if (target === 'eoq') {
        solveEoqModel();
      } else if (target === 'markov') {
        solveMarkovModel();
      }
    }
  });
});

/* -------------------------------------------------------------
   Fraction formatting helper (Continued Fractions Algorithm)
   ------------------------------------------------------------- */
function formatNumber(val, maxDenominator = 1000) {
  if (Math.abs(val) < 1e-9) return '0';
  if (Math.abs(val - Math.round(val)) < 1e-9) return Math.round(val).toString();
  
  const tolerance = 1e-6;
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let b = absVal;
  do {
    let a = Math.floor(b);
    let aux = h1; h1 = a * h1 + h2; h2 = aux;
    aux = k1; k1 = a * k1 + k2; k2 = aux;
    b = 1 / (b - a);
  } while (Math.abs(absVal - h1 / k1) > tolerance && k1 < maxDenominator);
  
  if (k1 < maxDenominator && Math.abs(absVal - h1 / k1) < tolerance) {
    if (k1 === 1) return (isNegative ? '-' : '') + h1.toString();
    return (isNegative ? '-' : '') + `${h1}/${k1}`;
  }
  return val.toFixed(2);
}

/* -------------------------------------------------------------
   Big M exact number class [Real Part, M Coefficient Part]
   ------------------------------------------------------------- */
class BigM {
  constructor(r = 0, m = 0) {
    this.r = r;
    this.m = m;
  }
  add(o) { return new BigM(this.r + o.r, this.m + o.m); }
  sub(o) { return new BigM(this.r - o.r, this.m - o.m); }
  mul(scalar) { return new BigM(this.r * scalar, this.m * scalar); }
  div(scalar) { return new BigM(this.r / scalar, this.m / scalar); }
  neg() { return new BigM(-this.r, -this.m); }
  
  // Z-row optimality check comparison: most negative enters
  lt(o) {
    if (Math.abs(this.m - o.m) > 1e-9) {
      return this.m < o.m;
    }
    return this.r < o.r;
  }
  
  isZero() {
    return Math.abs(this.r) < 1e-9 && Math.abs(this.m) < 1e-9;
  }
  
  toString() {
    if (Math.abs(this.m) < 1e-9) return formatNumber(this.r);
    
    let mStr = "";
    if (Math.abs(this.m - 1) < 1e-9) mStr = "M";
    else if (Math.abs(this.m + 1) < 1e-9) mStr = "-M";
    else mStr = `${formatNumber(this.m)}M`;
    
    if (Math.abs(this.r) < 1e-9) return mStr;
    
    if (this.r > 0) {
      return `${mStr} + ${formatNumber(this.r)}`;
    } else {
      return `${mStr} - ${formatNumber(Math.abs(this.r))}`;
    }
  }
}

/* -------------------------------------------------------------
   1. Navbar Scroll & Dynamic Tab Binding
   ------------------------------------------------------------- */
function initNavbar() {
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');

  // Change navbar appearance on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.add('scrolled'); // Force scrolled background in solver dashboard
    }
  });

  // Mobile menu toggle
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      menuToggle.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
    });
  }

  // Bind links to tab switching
  document.querySelectorAll('.nav-tab-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabTarget = link.getAttribute('data-tab');
      const targetTabButton = document.querySelector(`.dash-preview-tab[data-tab="${tabTarget}"]`);
      
      if (targetTabButton) {
        targetTabButton.click();
        const section = document.getElementById('dashboard-preview');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      }
      if (navLinks) {
        navLinks.classList.remove('active');
        if (menuToggle) menuToggle.textContent = '☰';
      }
    });
  });
}

function initDashboardTabs() {
  const tabs = document.querySelectorAll('.dash-preview-tab');
  const panes = document.querySelectorAll('.dash-preview-pane');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      panes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `pane-${target}`) {
          pane.classList.add('active');
        }
      });
      
      if (target === 'eoq') {
        setTimeout(solveEoqModel, 100);
      } else if (target === 'simplex') {
        setTimeout(solveSimplexModel, 100);
      } else if (target === 'bigm') {
        setTimeout(solveBigMModel, 100);
      } else if (target === 'graphical') {
        setTimeout(solveGraphicalModel, 100);
      } else if (target === 'markov') {
        setTimeout(solveMarkovModel, 100);
      }
    });
  });
}

/* -------------------------------------------------------------
   2. SIMPLEX & GRAN M SOLVER SYSTEM
   ------------------------------------------------------------- */
function initSimplexForm() {
  const selectVars = document.getElementById('simplex-vars-count');
  const selectConst = document.getElementById('simplex-const-count');
  
  if (!selectVars || !selectConst) return;

  const rebuild = () => {
    const numVars = parseInt(selectVars.value);
    const numConst = parseInt(selectConst.value);
    
    // Generate Objective Row
    const objRow = document.getElementById('simplex-obj-row');
    objRow.innerHTML = '';
    const objLabel = document.createElement('span');
    objLabel.className = 'var-term';
    objLabel.innerHTML = 'Z = &nbsp;';
    objRow.appendChild(objLabel);

    for (let j = 1; j <= numVars; j++) {
      const cell = document.createElement('div');
      cell.className = 'coeff-cell';
      cell.innerHTML = `
        <input type="number" id="simplex-c-${j}" value="${j === 1 ? 3 : 5}" class="solver-input">
        <span class="var-term">x<sub>${j}</sub></span>
        ${j < numVars ? '<span class="var-term">&nbsp;+&nbsp;</span>' : ''}
      `;
      objRow.appendChild(cell);
    }

    // Generate Constraints (fixed to <= for Standard Simplex)
    const constContainer = document.getElementById('simplex-constraints-container');
    constContainer.innerHTML = '';

    for (let i = 1; i <= numConst; i++) {
      const row = document.createElement('div');
      row.className = 'constraint-row';
      
      let varsHTML = '';
      for (let j = 1; j <= numVars; j++) {
        // Default values for coefficients
        let defaultVal = 1;
        if (i === 1 && j === 1) defaultVal = 1;
        else if (i === 1 && j === 2) defaultVal = 0; // x1 <= 4
        else if (i === 2 && j === 1) defaultVal = 0;
        else if (i === 2 && j === 2) defaultVal = 2; // 2x2 <= 12
        else if (i === 3 && j === 1) defaultVal = 3;
        else if (i === 3 && j === 2) defaultVal = 2; // 3x1 + 2x2 <= 18

        varsHTML += `
          <div class="coeff-cell">
            <input type="number" id="simplex-a-${i}-${j}" value="${defaultVal}" class="solver-input">
            <span class="var-term">x<sub>${j}</sub></span>
            ${j < numVars ? '<span class="var-term">&nbsp;+&nbsp;</span>' : ''}
          </div>
        `;
      }

      // Default RHS values
      let defaultRHS = 10;
      if (i === 1) defaultRHS = 4;
      else if (i === 2) defaultRHS = 12;
      else if (i === 3) defaultRHS = 18;

      row.innerHTML = `
        <span class="var-term" style="margin-right:0.5rem; color: var(--text-gray-dark);">[${i}]</span>
        ${varsHTML}
        <span class="var-term" style="color: var(--primary-cyan); font-weight: bold; margin: 0 0.5rem;">&le;</span>
        <input type="hidden" id="simplex-sign-${i}" value="<=">
        <input type="number" id="simplex-rhs-${i}" value="${defaultRHS}" class="solver-input" style="width: 60px; text-align:center; padding:0;">
      `;
      constContainer.appendChild(row);
    }
  };

  selectVars.addEventListener('change', rebuild);
  selectConst.addEventListener('change', rebuild);
  rebuild();
}

function initBigMForm() {
  const selectVars = document.getElementById('bigm-vars-count');
  const selectConst = document.getElementById('bigm-const-count');
  
  if (!selectVars || !selectConst) return;

  const rebuild = () => {
    const numVars = parseInt(selectVars.value);
    const numConst = parseInt(selectConst.value);
    
    // Generate Objective Row
    const objRow = document.getElementById('bigm-obj-row');
    objRow.innerHTML = '';
    const objLabel = document.createElement('span');
    objLabel.className = 'var-term';
    objLabel.innerHTML = 'Z = &nbsp;';
    objRow.appendChild(objLabel);

    for (let j = 1; j <= numVars; j++) {
      const cell = document.createElement('div');
      cell.className = 'coeff-cell';
      cell.innerHTML = `
        <input type="number" id="bigm-c-${j}" value="${j === 1 ? 3 : 5}" class="solver-input">
        <span class="var-term">x<sub>${j}</sub></span>
        ${j < numVars ? '<span class="var-term">&nbsp;+&nbsp;</span>' : ''}
      `;
      objRow.appendChild(cell);
    }

    // Generate Constraints (with <=, >=, = selects for Big M)
    const constContainer = document.getElementById('bigm-constraints-container');
    constContainer.innerHTML = '';

    for (let i = 1; i <= numConst; i++) {
      const row = document.createElement('div');
      row.className = 'constraint-row';
      
      let varsHTML = '';
      for (let j = 1; j <= numVars; j++) {
        let defaultVal = 1;
        if (i === 1 && j === 1) defaultVal = 1;
        else if (i === 1 && j === 2) defaultVal = 0; 
        else if (i === 2 && j === 1) defaultVal = 0;
        else if (i === 2 && j === 2) defaultVal = 2; 
        else if (i === 3 && j === 1) defaultVal = 3;
        else if (i === 3 && j === 2) defaultVal = 2; 

        varsHTML += `
          <div class="coeff-cell">
            <input type="number" id="bigm-a-${i}-${j}" value="${defaultVal}" class="solver-input">
            <span class="var-term">x<sub>${j}</sub></span>
            ${j < numVars ? '<span class="var-term">&nbsp;+&nbsp;</span>' : ''}
          </div>
        `;
      }

      let defaultRHS = 10;
      if (i === 1) defaultRHS = 4;
      else if (i === 2) defaultRHS = 12;
      else if (i === 3) defaultRHS = 18;

      row.innerHTML = `
        <span class="var-term" style="margin-right:0.5rem; color: var(--text-gray-dark);">[${i}]</span>
        ${varsHTML}
        <select id="bigm-sign-${i}" class="solver-select constraint-sign">
          <option value="<=" selected>&le;</option>
          <option value=">=">&ge;</option>
          <option value="=">=</option>
        </select>
        <input type="number" id="bigm-rhs-${i}" value="${defaultRHS}" class="solver-input" style="width: 60px; text-align:center; padding:0;">
      `;
      constContainer.appendChild(row);
    }
  };

  selectVars.addEventListener('change', rebuild);
  selectConst.addEventListener('change', rebuild);
  rebuild();
}

function solveSimplexModel() {
  runSimplexSolver('simplex');
}

function solveBigMModel() {
  runSimplexSolver('bigm');
}

function runSimplexSolver(prefix) {
  const optType = document.getElementById(`${prefix}-opt-type`).value;
  const numVars = parseInt(document.getElementById(`${prefix}-vars-count`).value);
  const numConst = parseInt(document.getElementById(`${prefix}-const-count`).value);
  const output = document.getElementById(`${prefix}-output-area`);
  
  if (!output) return;
  output.innerHTML = '<h3 style="color: var(--primary-cyan); margin-bottom:1rem;">Ejecutando algoritmo...</h3>';

  // Read objective coefficients
  const c = [];
  for (let j = 1; j <= numVars; j++) {
    c.push(parseFloat(document.getElementById(`${prefix}-c-${j}`).value) || 0);
  }

  // Read constraints coefficients
  const A = [];
  const signs = [];
  const b = [];
  for (let i = 1; i <= numConst; i++) {
    const row = [];
    for (let j = 1; j <= numVars; j++) {
      row.push(parseFloat(document.getElementById(`${prefix}-a-${i}-${j}`).value) || 0);
    }
    A.push(row);
    signs.push(document.getElementById(`${prefix}-sign-${i}`).value);
    b.push(parseFloat(document.getElementById(`${prefix}-rhs-${i}`).value) || 0);
  }

  // PRE-PROCESSING: RHS must be >= 0
  for (let i = 0; i < numConst; i++) {
    if (b[i] < 0) {
      b[i] = -b[i];
      for (let j = 0; j < numVars; j++) {
        A[i][j] = -A[i][j];
      }
      if (signs[i] === '<=') signs[i] = '>=';
      else if (signs[i] === '>=') signs[i] = '<=';
    }
  }

  // Count slacks, surplus, artificial variables
  let numSlacks = 0;
  let numSurplus = 0;
  let numArtificials = 0;
  
  // Track which row gets what variable
  for (let i = 0; i < numConst; i++) {
    if (signs[i] === '<=') {
      numSlacks++;
    } else if (signs[i] === '>=') {
      numSurplus++;
      numArtificials++;
    } else if (signs[i] === '=') {
      numArtificials++;
    }
  }

  // Columns definition:
  // x_1 .. x_numVars | s_1 .. s_numSlacks | e_1 .. s_numSurplus | a_1 .. a_numArtificials | RHS
  const colNames = [];
  for (let j = 1; j <= numVars; j++) colNames.push(`x${j}`);
  for (let j = 1; j <= numSlacks; j++) colNames.push(`s${j}`);
  for (let j = 1; j <= numSurplus; j++) colNames.push(`e${j}`);
  for (let j = 1; j <= numArtificials; j++) colNames.push(`a${j}`);
  colNames.push('RHS');

  const totalCols = colNames.length - 1; // RHS is last
  const rhsCol = totalCols;

  // Matrix allocation
  const tableau = [];
  for (let i = 0; i <= numConst; i++) {
    const row = [];
    for (let j = 0; j <= totalCols; j++) {
      row.push(new BigM(0, 0));
    }
    tableau.push(row);
  }

  // Setup constraints in tableau
  let curSlack = 0;
  let curSurplus = 0;
  let curArt = 0;
  const initialBasis = []; // Track basic variable name for each constraint row

  for (let i = 0; i < numConst; i++) {
    // Decision variables
    for (let j = 0; j < numVars; j++) {
      tableau[i][j] = new BigM(A[i][j], 0);
    }
    
    // RHS
    tableau[i][rhsCol] = new BigM(b[i], 0);

    // Slack, Surplus, Artificial columns offsets
    const slackOffset = numVars;
    const surplusOffset = numVars + numSlacks;
    const artOffset = numVars + numSlacks + numSurplus;

    if (signs[i] === '<=') {
      tableau[i][slackOffset + curSlack] = new BigM(1, 0);
      initialBasis.push(`s${curSlack + 1}`);
      curSlack++;
    } else if (signs[i] === '>=') {
      tableau[i][surplusOffset + curSurplus] = new BigM(-1, 0);
      tableau[i][artOffset + curArt] = new BigM(1, 0);
      initialBasis.push(`a${curArt + 1}`);
      curSurplus++;
      curArt++;
    } else if (signs[i] === '=') {
      tableau[i][artOffset + curArt] = new BigM(1, 0);
      initialBasis.push(`a${curArt + 1}`);
      curArt++;
    }
  }

  // Setup Z-row (Cost Row)
  const scale = (optType === 'max') ? 1 : -1;
  
  for (let j = 0; j < numVars; j++) {
    tableau[numConst][j] = new BigM(-c[j] * scale, 0);
  }

  // Artificial penalty in Z-row
  const artOffset = numVars + numSlacks + numSurplus;
  for (let j = 0; j < numArtificials; j++) {
    tableau[numConst][artOffset + j] = new BigM(0, 1); // +1 * M
  }

  // Standard form HTML
  let stdHTML = `<div class="iteration-tableau-card" style="border-color: var(--border-active);">
    <h4 style="color: var(--primary-cyan); font-size: 0.95rem; margin-bottom: 0.5rem;">Forma Estándar (PL)</h4>
    <p style="font-size:0.8rem; color: var(--text-gray-muted); margin-bottom:0.8rem;">
      Se introducen variables de holgura ($s_i$), exceso ($e_i$) y artificiales ($a_i$).
    </p>
    <div style="font-family: monospace; font-size: 0.85rem; line-height: 1.5; padding: 0.8rem; background: rgba(0,0,0,0.3); border-radius: 6px;">
      <strong>Objetivo:</strong> ${optType === 'max' ? 'Max' : 'Min'} Z = `;
  
  for (let j = 0; j < numVars; j++) {
    stdHTML += `${c[j]}x<sub>${j+1}</sub> ${j < numVars - 1 ? '+ ' : ''}`;
  }
  if (numArtificials > 0) {
    stdHTML += ` - M(`;
    for (let k = 1; k <= numArtificials; k++) {
      stdHTML += `a<sub>${k}</sub>${k < numArtificials ? '+' : ''}`;
    }
    stdHTML += `)`;
  }
  stdHTML += `<br><strong>Restricciones:</strong><br>`;
  for (let i = 0; i < numConst; i++) {
    let constStr = "";
    for (let j = 0; j < numVars; j++) {
      constStr += `${A[i][j]}x<sub>${j+1}</sub> + `;
    }
    constStr = constStr.substring(0, constStr.length - 2);
    if (signs[i] === '<=') {
      constStr += `+ s<sub>${i+1}</sub>`;
    } else if (signs[i] === '>=') {
      constStr += `- e<sub>${curSurplus}</sub> + a<sub>${curArt}</sub>`;
    } else if (signs[i] === '=') {
      constStr += `+ a<sub>${curArt}</sub>`;
    }
    constStr += ` = ${b[i]}`;
    stdHTML += `&nbsp;&nbsp;[${i+1}] ${constStr}<br>`;
  }
  stdHTML += `</div></div>`;

  // ELIMINATION OF ARTIFICIAL VARIABLES FROM Z-ROW
  for (let i = 0; i < numConst; i++) {
    if (signs[i] === '>=' || signs[i] === '=') {
      for (let j = 0; j <= rhsCol; j++) {
        const penaltyVal = new BigM(0, tableau[i][j].r);
        tableau[numConst][j] = tableau[numConst][j].sub(penaltyVal);
      }
    }
  }

  // Iterate Simplex
  const iterationsLog = [];
  let currentBasis = [...initialBasis];
  let solved = false;
  let iterations = 0;
  const maxIterations = 20;

  recordIteration(tableau, colNames, currentBasis, numConst, rhsCol, "Tabla Inicial (Mapeo Estándar)", iterationsLog);

  let unbounded = false;

  while (!solved && iterations < maxIterations) {
    let enteringCol = -1;
    let minCoeff = new BigM(0, 0);

    for (let j = 0; j < rhsCol; j++) {
      if (tableau[numConst][j].lt(minCoeff)) {
        minCoeff = tableau[numConst][j];
        enteringCol = j;
      }
    }

    if (enteringCol === -1) {
      solved = true;
      break;
    }

    let leavingRow = -1;
    let minRatio = Infinity;

    for (let i = 0; i < numConst; i++) {
      const val = tableau[i][enteringCol].r;
      if (val > 1e-9) {
        const rhsVal = tableau[i][rhsCol].r;
        const ratio = rhsVal / val;
        if (ratio < minRatio) {
          minRatio = ratio;
          leavingRow = i;
        }
      }
    }

    if (leavingRow === -1) {
      unbounded = true;
      break;
    }

    const pivotVal = tableau[leavingRow][enteringCol].r;
    const enteringVarName = colNames[enteringCol];
    const leavingVarName = currentBasis[leavingRow];
    
    for (let j = 0; j <= rhsCol; j++) {
      tableau[leavingRow][j] = tableau[leavingRow][j].div(pivotVal);
    }

    for (let i = 0; i <= numConst; i++) {
      if (i !== leavingRow) {
        const factor = tableau[i][enteringCol];
        for (let j = 0; j <= rhsCol; j++) {
          tableau[i][j] = tableau[i][j].sub(factor.mul(tableau[leavingRow][j]));
        }
      }
    }

    currentBasis[leavingRow] = enteringVarName;
    iterations++;

    recordIteration(
      tableau, 
      colNames, 
      currentBasis, 
      numConst, 
      rhsCol, 
      `Iteración ${iterations}: Entra ${enteringVarName}, Sale ${leavingVarName} (Pivote: ${formatNumber(pivotVal)})`, 
      iterationsLog,
      leavingRow,
      enteringCol
    );
  }

  // Check feasibility
  let infeasible = false;
  if (!unbounded) {
    for (let i = 0; i < numConst; i++) {
      if (currentBasis[i].startsWith('a') && Math.abs(tableau[i][rhsCol].r) > 1e-4) {
        infeasible = true;
      }
    }
  }

  // Z-optimal final calculation
  let finalZ = 0;
  let optimalValues = {};
  for (let j = 1; j <= numVars; j++) {
    optimalValues[`x${j}`] = 0;
  }

  let finalHTML = stdHTML;
  
  iterationsLog.forEach((step, idx) => {
    finalHTML += renderTableauHTML(step, idx);
  });

  if (unbounded) {
    finalHTML += `
      <div class="optimal-solution-card" style="border-color: #ff5f56; background: rgba(255,95,86,0.05);">
        <h4 style="color:#ff5f56;">⚠️ Solución Ilimitada</h4>
        <p style="font-size:0.85rem; line-height:1.5; color: var(--text-gray-light);">
          El problema no está acotado (se puede incrementar Z indefinidamente). Todas las razones del coeficiente pivote son negativas o cero.
        </p>
      </div>
    `;
  } else if (infeasible) {
    finalHTML += `
      <div class="optimal-solution-card" style="border-color: #ffbd2e; background: rgba(255,189,46,0.05);">
        <h4 style="color:#ffbd2e;">⚠️ Sistema Infactible</h4>
        <p style="font-size:0.85rem; line-height:1.5; color: var(--text-gray-light);">
          No existe una solución factible que cumpla con todas las restricciones del modelo. Alguna variable artificial permaneció en la base con un valor mayor a cero.
        </p>
      </div>
    `;
  } else {
    finalZ = tableau[numConst][rhsCol].r * scale;
    if (Math.abs(finalZ - Math.round(finalZ)) < 1e-6) finalZ = Math.round(finalZ);

    let varsReportHTML = "";
    for (let i = 0; i < numConst; i++) {
      const varName = currentBasis[i];
      let val = tableau[i][rhsCol].r;
      if (Math.abs(val - Math.round(val)) < 1e-6) val = Math.round(val);
      optimalValues[varName] = val;
    }

    for (let j = 1; j <= numVars; j++) {
      varsReportHTML += `<div class="optimal-var-item">x<sub>${j}</sub> = <span>${formatNumber(optimalValues[`x${j}`])}</span></div>`;
    }

    finalHTML += `
      <div class="optimal-solution-card">
        <h4>🏆 Solución Óptima Encontrada</h4>
        <p style="font-size: 0.85rem; color: var(--text-gray-muted); margin-bottom: 0.8rem;">
          El algoritmo finalizó con éxito en <strong>${iterations} iteraciones</strong>. Los valores que maximizan/minimizan Z son:
        </p>
        <div class="optimal-vars-list">
          ${varsReportHTML}
          <div class="optimal-var-item" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:0.5rem; margin-top:0.3rem;">
            Valor Óptimo Z = <span style="color: #27c93f; font-size:1.15rem;">${formatNumber(finalZ)}</span>
          </div>
        </div>
      </div>
    `;
  }

  if (numVars === 2) {
    finalHTML += `
      <div class="iteration-tableau-card" style="border-color: var(--primary-cyan); margin-top: 1.5rem;">
        <div class="simplex-iteration-title">
          <span>Solución Gráfica (Método Gráfico)</span>
          <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-gray-dark);">[grafica-2d]</span>
        </div>
        <div class="simplex-graphical-layout" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; padding: 1.5rem; text-align: left;">
          <div style="position: relative; width: 100%; height: 320px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-light); border-radius: 8px; overflow: hidden; padding: 0.5rem;">
            <canvas id="live-${prefix}-canvas" style="width: 100%; height: 100%;"></canvas>
          </div>
          <div class="simplex-interpretation" style="margin: 0; display: flex; flex-direction: column; justify-content: center;">
            <strong>📈 Interpretación Gráfica:</strong><br>
            <div id="${prefix}-graphical-interpretation-text" style="font-size: 0.85rem; line-height: 1.5; color: var(--text-gray-light); margin-top: 0.5rem;"></div>
          </div>
        </div>
      </div>
    `;
  }

  output.innerHTML = finalHTML;

  if (numVars === 2) {
    drawGraphicalMethod(`live-${prefix}-canvas`, `${prefix}-graphical-interpretation-text`, optType, numVars, numConst, c, A, signs, b, optimalValues, finalZ);
  }
}

function recordIteration(tab, cols, basis, numConst, rhsCol, title, log, pRow = -1, pCol = -1) {
  // Deep copy matrix
  const matCopy = [];
  for (let i = 0; i <= numConst; i++) {
    const row = [];
    for (let j = 0; j <= rhsCol; j++) {
      row.push(new BigM(tab[i][j].r, tab[i][j].m));
    }
    matCopy.push(row);
  }
  log.push({
    title,
    cols: [...cols],
    basis: [...basis],
    matrix: matCopy,
    pivotRow: pRow,
    pivotCol: pCol
  });
}

function renderTableauHTML(step, idx) {
  const isPurple = step.title.includes('Iteración') || step.title.includes('Gran M');
  
  let headerCells = `<th>Base</th>`;
  step.cols.forEach(col => {
    headerCells += `<th>${col}</th>`;
  });

  let rowCells = "";
  for (let i = 0; i < step.matrix.length - 1; i++) {
    let cells = `<td><strong>${step.basis[i]}</strong></td>`;
    for (let j = 0; j < step.matrix[i].length; j++) {
      const isPivot = (i === step.pivotRow && j === step.pivotCol);
      const cellVal = step.matrix[i][j].toString();
      cells += `<td class="${isPivot ? 'simplex-pivot-cell' : ''}">${cellVal}</td>`;
    }
    rowCells += `<tr class="${i === step.pivotRow ? 'simplex-pivot-row' : ''}">${cells}</tr>`;
  }

  // Z-row cell rendering
  let zCells = `<td><strong>Z</strong></td>`;
  for (let j = 0; j < step.matrix[step.matrix.length - 1].length; j++) {
    zCells += `<td>${step.matrix[step.matrix.length - 1][j].toString()}</td>`;
  }
  rowCells += `<tr>${zCells}</tr>`;

  return `
    <div class="iteration-tableau-card">
      <div class="simplex-iteration-title ${isPurple ? 'purple-title' : ''}">
        <span>${step.title}</span>
        <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-gray-dark);">[tabla-${idx}]</span>
      </div>
      <div class="simplex-table-wrapper">
        <table class="simplex-table">
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>
            ${rowCells}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* -------------------------------------------------------------
   3. HUNGARIAN METHOD SOLVER SYSTEM
   ------------------------------------------------------------- */
function initHungarianForm() {
  const sizeSelect = document.getElementById('hungarian-size');
  if (!sizeSelect) return;

  const rebuild = () => {
    const N = parseInt(sizeSelect.value);
    const container = document.getElementById('hungarian-matrix-container');
    container.innerHTML = '';

    let tableHTML = `<table class="matrix-grid-table"><thead><tr><th></th>`;
    for (let j = 1; j <= N; j++) tableHTML += `<th>Tarea ${j}</th>`;
    tableHTML += `</tr></thead><tbody>`;

    // Cost matrix values placeholder
    const defaults = [
      [9, 2, 7, 8, 3],
      [6, 4, 3, 7, 5],
      [5, 8, 2, 4, 6],
      [7, 6, 9, 4, 5],
      [4, 7, 5, 6, 8]
    ];

    for (let i = 1; i <= N; i++) {
      tableHTML += `<tr><th>Recurso ${String.fromCharCode(64 + i)}</th>`;
      for (let j = 1; j <= N; j++) {
        let val = defaults[i-1][j-1];
        tableHTML += `<td><input type="number" id="hungarian-cost-${i}-${j}" value="${val}" class="matrix-grid-input"></td>`;
      }
      tableHTML += `</tr>`;
    }
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
  };

  sizeSelect.addEventListener('change', rebuild);
  rebuild();
}

function solveHungarianModel() {
  const optType = document.getElementById('hungarian-opt-type').value;
  const N = parseInt(document.getElementById('hungarian-size').value);
  const output = document.getElementById('hungarian-output-area');

  output.innerHTML = '<h3>Resolviendo Modelo Húngaro...</h3>';

  // Read cost matrix
  const originalMatrix = [];
  for (let i = 1; i <= N; i++) {
    const row = [];
    for (let j = 1; j <= N; j++) {
      row.push(parseFloat(document.getElementById(`hungarian-cost-${i}-${j}`).value) || 0);
    }
    originalMatrix.push(row);
  }

  // Clone to work matrix
  let matrix = originalMatrix.map(row => [...row]);
  let stepsHTML = "";

  // If Maximization, subtract all elements from maximum value
  if (optType === 'max') {
    let maxVal = -Infinity;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (matrix[i][j] > maxVal) maxVal = matrix[i][j];
      }
    }
    stepsHTML += `<div class="hungarian-step-card">
      <div class="hungarian-step-title">Maximización a Minimización</div>
      <p style="font-size:0.8rem; color:var(--text-gray-muted); margin-bottom: 0.5rem;">
        Se resta cada costo del valor máximo de la matriz (${maxVal}) para convertir el problema en uno de minimización:
      </p>
      ${renderHungarianMatrixHTML(matrix.map(row => row.map(v => maxVal - v)))}
    </div>`;
    
    matrix = matrix.map(row => row.map(v => maxVal - v));
  }

  // Step 1: Row Reduction
  const rowMins = [];
  for (let i = 0; i < N; i++) {
    let min = Math.min(...matrix[i]);
    rowMins.push(min);
    for (let j = 0; j < N; j++) {
      matrix[i][j] -= min;
    }
  }

  stepsHTML += `<div class="hungarian-step-card">
    <div class="hungarian-step-title">Paso 1: Reducción de Filas</div>
    <p style="font-size:0.8rem; color:var(--text-gray-muted); margin-bottom:0.5rem;">
      Restar el menor costo de cada fila del resto de los costos de esa fila (Mínimos por fila: A=${rowMins[0]}, B=${rowMins[1]}, C=${rowMins[2]}${N >= 4 ? `, D=${rowMins[3]}` : ''}${N >= 5 ? `, E=${rowMins[4]}` : ''}):
    </p>
    ${renderHungarianMatrixHTML(matrix)}
  </div>`;

  // Step 2: Column Reduction
  const colMins = [];
  for (let j = 0; j < N; j++) {
    let min = Infinity;
    for (let i = 0; i < N; i++) {
      if (matrix[i][j] < min) min = matrix[i][j];
    }
    colMins.push(min);
    for (let i = 0; i < N; i++) {
      matrix[i][j] -= min;
    }
  }

  stepsHTML += `<div class="hungarian-step-card">
    <div class="hungarian-step-title">Paso 2: Reducción de Columnas</div>
    <p style="font-size:0.8rem; color:var(--text-gray-muted); margin-bottom:0.5rem;">
      Restar el menor costo de cada columna del resto de los costos de esa columna (Mínimos por columna: T1=${colMins[0]}, T2=${colMins[1]}, T3=${colMins[2]}${N >= 4 ? `, T4=${colMins[3]}` : ''}${N >= 5 ? `, T5=${colMins[4]}` : ''}):
    </p>
    ${renderHungarianMatrixHTML(matrix)}
  </div>`;

  // Covering Loop (Step 3 & 4)
  let optimalCover = false;
  let loops = 0;
  const maxLoops = 15;

  while (!optimalCover && loops < maxLoops) {
    loops++;
    const covering = findMinCoveringLines(matrix);
    const linesCount = (covering.rows.length + covering.cols.length);

    if (linesCount >= N) {
      optimalCover = true;
      stepsHTML += `<div class="hungarian-step-card">
        <div class="hungarian-step-title">Paso 3: Cubrir Ceros de Cobertura Óptima</div>
        <p style="font-size:0.8rem; color:var(--text-gray-muted); margin-bottom:0.5rem;">
          Se trazaron <strong>${linesCount} líneas</strong> para cubrir todos los ceros en la matriz. Como el número de líneas es igual a la dimensión de la matriz (${N}), se ha llegado al óptimo.
        </p>
      </div>`;
      break;
    }

    // Step 4: Matrix Adjustment
    // Find min uncovered element
    let minUncovered = Infinity;
    for (let i = 0; i < N; i++) {
      if (covering.rows.includes(i)) continue;
      for (let j = 0; j < N; j++) {
        if (covering.cols.includes(j)) continue;
        if (matrix[i][j] < minUncovered) minUncovered = matrix[i][j];
      }
    }

    // Adjust matrix: subtract minUncovered from uncovered, add to double-covered
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const rowCovered = covering.rows.includes(i);
        const colCovered = covering.cols.includes(j);

        if (!rowCovered && !colCovered) {
          matrix[i][j] -= minUncovered;
        } else if (rowCovered && colCovered) {
          matrix[i][j] += minUncovered;
        }
      }
    }

    stepsHTML += `<div class="hungarian-step-card">
      <div class="hungarian-step-title">Ajuste de Matriz (Líneas = ${linesCount} &lt; ${N})</div>
      <p style="font-size:0.8rem; color:var(--text-gray-muted); margin-bottom:0.5rem;">
        Se trazan solo ${linesCount} líneas para cubrir ceros. El menor elemento no cubierto es <strong>${minUncovered}</strong>. Se resta de todos los no cubiertos y se suma a las intersecciones:
      </p>
      ${renderHungarianMatrixHTML(matrix, covering)}
    </div>`;
  }

  // Find assignments using Permutation Search
  const assignments = findOptimalAssignments(matrix);
  
  if (!assignments) {
    output.innerHTML = stepsHTML + `<div class="optimal-solution-card" style="border-color:#ff5f56; background: rgba(255,95,86,0.05);">Error al encontrar combinaciones.</div>`;
    return;
  }

  // Generate results list
  let totalCost = 0;
  let listHTML = "";
  for (let i = 0; i < N; i++) {
    const assignedCol = assignments[i];
    const cost = originalMatrix[i][assignedCol];
    totalCost += cost;
    listHTML += `<div class="optimal-var-item">
      Recurso ${String.fromCharCode(64 + i + 1)} &rarr; Tarea ${assignedCol + 1} &nbsp; 
      <span style="color: var(--text-gray-dark); font-size:0.8rem;">(Costo: ${cost})</span>
    </div>`;
  }

  output.innerHTML = stepsHTML + `
    <div class="optimal-solution-card" style="border-color: var(--primary-purple);">
      <h4 style="color: var(--primary-purple);">🏆 Asignación Óptima Encontrada</h4>
      <p style="font-size:0.85rem; color:var(--text-gray-muted); margin-bottom:0.8rem;">
        Los emparejamientos que ${optType === 'min' ? 'minimizan' : 'maximizan'} los costos totales son:
      </p>
      <div class="optimal-vars-list">
        ${listHTML}
        <div class="optimal-var-item" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:0.5rem; margin-top:0.3rem;">
          Costo Total Óptimo = <span style="color: #27c93f; font-size:1.15rem;">$${totalCost}</span>
        </div>
      </div>
    </div>
  `;
}

function findMinCoveringLines(mat) {
  const N = mat.length;
  const zeros = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (Math.abs(mat[i][j]) < 1e-9) zeros.push({ r: i, c: j });
    }
  }

  let bestCover = null;
  let minLines = N + 1;
  const totalSubsets = 1 << (2 * N);

  for (let mask = 0; mask < totalSubsets; mask++) {
    let lines = 0;
    for (let i = 0; i < 2 * N; i++) {
      if ((mask & (1 << i)) !== 0) lines++;
    }

    if (lines >= minLines) continue;

    let coversAll = true;
    for (const zero of zeros) {
      const rowCov = (mask & (1 << zero.r)) !== 0;
      const colCov = (mask & (1 << (N + zero.c))) !== 0;
      if (!rowCov && !colCov) {
        coversAll = false;
        break;
      }
    }

    if (coversAll) {
      minLines = lines;
      const rows = [];
      const cols = [];
      for (let i = 0; i < N; i++) {
        if ((mask & (1 << i)) !== 0) rows.push(i);
        if ((mask & (1 << (N + i))) !== 0) cols.push(i);
      }
      bestCover = { rows, cols };
    }
  }
  return bestCover;
}

function findOptimalAssignments(mat) {
  const N = mat.length;
  
  // Permutation generator helper
  const permute = (arr) => {
    let result = [];
    const helper = (m, p = []) => {
      if (m.length === 0) {
        result.push(p);
      } else {
        for (let i = 0; i < m.length; i++) {
          let curr = m.slice();
          let next = curr.splice(i, 1);
          helper(curr.slice(), p.concat(next));
        }
      }
    };
    helper(arr);
    return result;
  };

  const cols = [];
  for (let j = 0; j < N; j++) cols.push(j);
  const permutations = permute(cols);

  // Search for permutations containing all zeros
  for (const perm of permutations) {
    let valid = true;
    for (let i = 0; i < N; i++) {
      if (Math.abs(mat[i][perm[i]]) > 1e-9) {
        valid = false;
        break;
      }
    }
    if (valid) return perm;
  }
  return null;
}

function renderHungarianMatrixHTML(mat, covering = null) {
  const N = mat.length;
  let headers = "<th></th>";
  for (let j = 1; j <= N; j++) headers += `<th>T${j}</th>`;

  let rows = "";
  for (let i = 0; i < N; i++) {
    let rowCells = `<th>R${String.fromCharCode(65 + i)}</th>`;
    const rowCovered = covering && covering.rows.includes(i);
    for (let j = 0; j < N; j++) {
      const colCovered = covering && covering.cols.includes(j);
      
      let style = "";
      if (rowCovered && colCovered) style = "background: rgba(189,0,255,0.18); border:1px solid var(--primary-purple);";
      else if (rowCovered || colCovered) style = "background: rgba(0,240,255,0.06);";
      
      rowCells += `<td style="${style} font-family: monospace;">${formatNumber(mat[i][j])}</td>`;
    }
    rows += `<tr>${rowCells}</tr>`;
  }

  return `<div class="simplex-table-wrapper" style="max-width:280px; margin: 0 auto;">
    <table class="simplex-table tp-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/* -------------------------------------------------------------
   4. TRANSPORTATION MATRIX SOLVER SYSTEM
   ------------------------------------------------------------- */
function initTransportForm() {
  const selectSources = document.getElementById('transport-sources');
  const selectDest = document.getElementById('transport-destinations');
  
  if (!selectSources || !selectDest) return;

  const rebuild = () => {
    const M = parseInt(selectSources.value);
    const N = parseInt(selectDest.value);
    const container = document.getElementById('transport-matrix-container');
    container.innerHTML = '';

    let headers = `<th>Origen</th>`;
    for (let j = 1; j <= N; j++) headers += `<th>Destino ${j}</th>`;
    headers += `<th>Oferta</th>`;

    // Defaults values for 3x3
    const defaults = [
      [4, 2, 7, 10],
      [6, 3, 5, 8],
      [3, 8, 6, 4]
    ];
    const defaultSupply = [120, 80, 100];
    const defaultDemand = [150, 70, 80, 50];

    let rowsHTML = "";
    for (let i = 1; i <= M; i++) {
      let cells = `<th>S${i}</th>`;
      for (let j = 1; j <= N; j++) {
        let val = defaults[i-1] ? (defaults[i-1][j-1] || 5) : 5;
        cells += `<td><input type="number" id="trans-cost-${i}-${j}" value="${val}" class="matrix-grid-input"></td>`;
      }
      let supplyVal = defaultSupply[i-1] || 100;
      cells += `<td><input type="number" id="trans-supply-${i}" value="${supplyVal}" class="matrix-grid-input" style="border-color:var(--border-purple);"></td>`;
      rowsHTML += `<tr>${cells}</tr>`;
    }

    // Demands row
    let demandCells = `<th>Demanda</th>`;
    for (let j = 1; j <= N; j++) {
      let demVal = defaultDemand[j-1] || 80;
      demandCells += `<td><input type="number" id="trans-demand-${j}" value="${demVal}" class="matrix-grid-input" style="border-color:var(--border-purple);"></td>`;
    }
    demandCells += `<td id="trans-total-sum" style="font-family:monospace; font-size:0.75rem; color: var(--text-gray-dark); text-align:center;">300/300</td>`;
    rowsHTML += `<tr>${demandCells}</tr>`;

    container.innerHTML = `<table class="matrix-grid-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>`;
  };

  selectSources.addEventListener('change', rebuild);
  selectDest.addEventListener('change', rebuild);
  rebuild();
}

function solveTransportModel() {
  const M = parseInt(document.getElementById('transport-sources').value);
  const N = parseInt(document.getElementById('transport-destinations').value);
  const output = document.getElementById('transport-output-area');

  output.innerHTML = '<h3>Calculando Soluciones Logísticas...</h3>';

  // Read Costs, Supply, Demand
  const costs = [];
  for (let i = 1; i <= M; i++) {
    const row = [];
    for (let j = 1; j <= N; j++) {
      row.push(parseFloat(document.getElementById(`trans-cost-${i}-${j}`).value) || 0);
    }
    costs.push(row);
  }
  const supply = [];
  for (let i = 1; i <= M; i++) {
    supply.push(parseFloat(document.getElementById(`trans-supply-${i}`).value) || 0);
  }
  const demand = [];
  for (let j = 1; j <= N; j++) {
    demand.push(parseFloat(document.getElementById(`trans-demand-${j}`).value) || 0);
  }

  // Verify balance
  const sumSupply = supply.reduce((a, b) => a + b, 0);
  const sumDemand = demand.reduce((a, b) => a + b, 0);

  // Auto Balance
  let activeCosts = costs.map(row => [...row]);
  let activeSupply = [...supply];
  let activeDemand = [...demand];
  let isBalanced = true;
  let balanceMsg = "";

  if (sumSupply > sumDemand) {
    // Add Dummy Destination
    const diff = sumSupply - sumDemand;
    isBalanced = false;
    balanceMsg = `Oferta (${sumSupply}) > Demanda (${sumDemand}). Se crea un Destino Ficticio D<sub>ficticio</sub> con Demanda = ${diff} y costos unitarios de envío = $0.`;
    activeDemand.push(diff);
    for (let i = 0; i < M; i++) {
      activeCosts[i].push(0);
    }
  } else if (sumDemand > sumSupply) {
    // Add Dummy Source
    const diff = sumDemand - sumSupply;
    isBalanced = false;
    balanceMsg = `Demanda (${sumDemand}) > Oferta (${sumSupply}). Se crea un Origen Ficticio S<sub>ficticia</sub> con Oferta = ${diff} y costos unitarios de envío = $0.`;
    activeSupply.push(diff);
    const dummyCostRow = Array(N).fill(0);
    activeCosts.push(dummyCostRow);
  }

  const numS = activeSupply.length;
  const numD = activeDemand.length;

  // Northwest Corner Method solver
  const nwAllocations = Array(numS).fill(null).map(() => Array(numD).fill(0));
  let nwSupply = [...activeSupply];
  let nwDemand = [...activeDemand];
  let nwCost = 0;
  let i = 0, j = 0;
  while (i < numS && j < numD) {
    let alloc = Math.min(nwSupply[i], nwDemand[j]);
    nwAllocations[i][j] = alloc;
    nwSupply[i] -= alloc;
    nwDemand[j] -= alloc;
    nwCost += alloc * activeCosts[i][j];

    if (nwSupply[i] === 0) i++;
    else if (nwDemand[j] === 0) j++;
  }

  // Minimum Cost Method solver
  const mcAllocations = Array(numS).fill(null).map(() => Array(numD).fill(0));
  let mcSupply = [...activeSupply];
  let mcDemand = [...activeDemand];
  let mcCost = 0;
  let mcRemainingCells = [];
  for (let r = 0; r < numS; r++) {
    for (let c = 0; c < numD; c++) {
      mcRemainingCells.push({ r, c, cost: activeCosts[r][c] });
    }
  }
  // Sort cells by cost ascending
  mcRemainingCells.sort((a, b) => a.cost - b.cost);

  while (mcRemainingCells.length > 0) {
    // Find first cell with available supply and demand
    const cellIdx = mcRemainingCells.findIndex(cell => mcSupply[cell.r] > 0 && mcDemand[cell.c] > 0);
    if (cellIdx === -1) break;

    const cell = mcRemainingCells[cellIdx];
    let alloc = Math.min(mcSupply[cell.r], mcDemand[cell.c]);
    mcAllocations[cell.r][cell.c] = alloc;
    mcSupply[cell.r] -= alloc;
    mcDemand[cell.c] -= alloc;
    mcCost += alloc * activeCosts[cell.r][cell.c];
    
    mcRemainingCells.splice(cellIdx, 1);
  }

  // Vogel's Approximation Method solver
  const vamAllocations = Array(numS).fill(null).map(() => Array(numD).fill(0));
  let vamSupply = [...activeSupply];
  let vamDemand = [...activeDemand];
  let vamCost = 0;
  let rowActive = Array(numS).fill(true);
  let colActive = Array(numD).fill(true);

  let stepsRemaining = numS + numD - 1;
  while (stepsRemaining > 0) {
    // 1. Calculate row difference
    const rowDiffs = [];
    for (let r = 0; r < numS; r++) {
      if (!rowActive[r]) {
        rowDiffs.push(-1);
        continue;
      }
      // Find 2 lowest active costs in row r
      const activeRowCosts = [];
      for (let c = 0; c < numD; c++) {
        if (colActive[c]) activeRowCosts.push({ c, cost: activeCosts[r][c] });
      }
      activeRowCosts.sort((a, b) => a.cost - b.cost);
      if (activeRowCosts.length >= 2) {
        rowDiffs.push(activeRowCosts[1].cost - activeRowCosts[0].cost);
      } else if (activeRowCosts.length === 1) {
        rowDiffs.push(activeRowCosts[0].cost);
      } else {
        rowDiffs.push(-1);
      }
    }

    // 2. Calculate col difference
    const colDiffs = [];
    for (let c = 0; c < numD; c++) {
      if (!colActive[c]) {
        colDiffs.push(-1);
        continue;
      }
      const activeColCosts = [];
      for (let r = 0; r < numS; r++) {
        if (rowActive[r]) activeColCosts.push({ r, cost: activeCosts[r][c] });
      }
      activeColCosts.sort((a, b) => a.cost - b.cost);
      if (activeColCosts.length >= 2) {
        colDiffs.push(activeColCosts[1].cost - activeColCosts[0].cost);
      } else if (activeColCosts.length === 1) {
        colDiffs.push(activeColCosts[0].cost);
      } else {
        colDiffs.push(-1);
      }
    }

    // Find max difference
    let maxDiff = -Infinity;
    let targetType = ""; // "row" or "col"
    let targetIdx = -1;

    for (let r = 0; r < numS; r++) {
      if (rowDiffs[r] > maxDiff) {
        maxDiff = rowDiffs[r];
        targetType = "row";
        targetIdx = r;
      }
    }
    for (let c = 0; c < numD; c++) {
      if (colDiffs[c] > maxDiff) {
        maxDiff = colDiffs[c];
        targetType = "col";
        targetIdx = c;
      }
    }

    if (targetIdx === -1) break;

    // In target row/col, find cell with min cost
    let pRow = -1;
    let pCol = -1;
    let minCost = Infinity;

    if (targetType === "row") {
      pRow = targetIdx;
      for (let c = 0; c < numD; c++) {
        if (colActive[c] && activeCosts[pRow][c] < minCost) {
          minCost = activeCosts[pRow][c];
          pCol = c;
        }
      }
    } else {
      pCol = targetIdx;
      for (let r = 0; r < numS; r++) {
        if (rowActive[r] && activeCosts[r][pCol] < minCost) {
          minCost = activeCosts[r][pCol];
          pRow = r;
        }
      }
    }

    // Allocate
    let alloc = Math.min(vamSupply[pRow], vamDemand[pCol]);
    vamAllocations[pRow][pCol] = alloc;
    vamSupply[pRow] -= alloc;
    vamDemand[pCol] -= alloc;
    vamCost += alloc * activeCosts[pRow][pCol];

    if (vamSupply[pRow] === 0) rowActive[pRow] = false;
    if (vamDemand[pCol] === 0) colActive[pCol] = false;
    
    stepsRemaining--;
  }

  // Build Output HTML
  let resultHTML = "";
  if (!isBalanced) {
    resultHTML += `<div class="simplex-interpretation" style="margin-bottom:1rem; border-color:var(--primary-purple); background:rgba(189,0,255,0.02)">
      <strong>💡 Ajuste de Balanceo:</strong> ${balanceMsg}
    </div>`;
  }

  // Draw allocations table for Vogel (VAM) which usually is the best initial solution
  let tableHeaders = "<th>Origen</th>";
  for (let j = 1; j <= numD; j++) {
    const isDummy = (j === numD && sumSupply > sumDemand);
    tableHeaders += `<th>Destino ${isDummy ? 'Ficticio' : j}</th>`;
  }
  tableHeaders += "<th>Oferta</th>";

  let tableRows = "";
  for (let r = 0; r < numS; r++) {
    const isDummyRow = (r === numS && sumDemand > sumSupply);
    let cells = `<th>S${isDummyRow ? 'Ficticio' : r+1}</th>`;
    for (let c = 0; c < numD; c++) {
      const alloc = vamAllocations[r][c];
      const cost = activeCosts[r][c];
      if (alloc > 0) {
        cells += `<td class="tp-cell allocated">
          <span class="tp-cell-cost">$${cost}</span>
          <div class="tp-cell-alloc">${alloc}</div>
        </td>`;
      } else {
        cells += `<td class="tp-cell">
          <span class="tp-cell-cost" style="color:var(--text-gray-dark);">$${cost}</span>
          <div class="tp-cell-alloc" style="color:transparent; font-size:0.8rem;">-</div>
        </td>`;
      }
    }
    cells += `<td><strong>${activeSupply[r]}</strong></td>`;
    tableRows += `<tr>${cells}</tr>`;
  }

  // Demands Row
  let demandCells = "<th>Demanda</th>";
  for (let c = 0; c < numD; c++) {
    demandCells += `<td><strong>${activeDemand[c]}</strong></td>`;
  }
  demandCells += `<td><strong>${sumSupply}</strong></td>`;
  tableRows += `<tr>${demandCells}</tr>`;

  resultHTML += `
    <div class="iteration-tableau-card">
      <div class="simplex-iteration-title">Matriz de Distribución (Vogel - VAM)</div>
      <div class="simplex-table-wrapper">
        <table class="simplex-table tp-table">
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  `;

  // Compare summary
  resultHTML += `
    <div class="tp-compare-card" style="margin-bottom: 1.5rem;">
      <div class="simplex-log-title" style="margin-bottom:0.5rem;">Comparación de Métodos Logísticos</div>
      <div style="font-size:0.75rem; color:var(--text-gray-muted); margin-bottom:1rem;">Costos totales de transporte estimados para cada algoritmo:</div>
      
      <div class="tp-compare-row">
        <span class="tp-comp-name">Esquina Noroeste (NW Corner)</span>
        <span class="tp-comp-val">$${nwCost.toLocaleString()}</span>
      </div>
      <div class="tp-compare-row">
        <span class="tp-comp-name">Costo Mínimo (Least Cost)</span>
        <span class="tp-comp-val">$${mcCost.toLocaleString()}</span>
      </div>
      <div class="tp-compare-row">
        <span class="tp-comp-name">Aproximación de Vogel (VAM)</span>
        <span class="tp-comp-val best">🏆 $${vamCost.toLocaleString()}</span>
      </div>
    </div>

    <div class="simplex-interpretation">
      <strong>💡 Análisis Logístico:</strong> El método de **Vogel (VAM)** proporciona el plan de distribución inicial óptimo con un costo total de **$${vamCost.toLocaleString()}**. Esto representa un ahorro comparado con otros modelos.
    </div>
  `;

  output.innerHTML = resultHTML;
}

/* -------------------------------------------------------------
   5. EOQ INVENTORY SOLVER SYSTEM
   ------------------------------------------------------------- */
function solveEoqModel() {
  const D = parseFloat(document.getElementById('eoq-in-D').value) || 1000;
  const S = parseFloat(document.getElementById('eoq-in-S').value) || 50;
  const H = parseFloat(document.getElementById('eoq-in-H').value) || 5;
  const L = parseFloat(document.getElementById('eoq-in-L').value) || 7;

  // EOQ Formula: Q = sqrt(2DS/H)
  const Q = Math.sqrt((2 * D * S) / H);
  const N = D / Q;
  const T = 365 / N;
  const TC = (D / Q) * S + (Q / 2) * H;
  const ROP = (D / 365) * L;

  // Update Summary numbers
  document.getElementById('res-eoq-q').textContent = Math.round(Q) + ' u';
  document.getElementById('res-eoq-n').textContent = N.toFixed(1);
  document.getElementById('res-eoq-t').textContent = Math.round(T) + ' días';
  document.getElementById('res-eoq-rop').textContent = ROP.toFixed(1) + ' u';
  document.getElementById('res-eoq-tc').textContent = '$' + Math.round(TC).toLocaleString();

  // Update Formulas Applied Card
  document.getElementById('f-calc-eoq').innerHTML = `EOQ = &radic;( 2 &middot; ${D} &middot; ${S} / ${H} ) = <strong>${Q.toFixed(2)} unidades</strong>`;
  document.getElementById('f-calc-n').innerHTML = `N = ${D} / ${Q.toFixed(2)} = <strong>${N.toFixed(2)} pedidos/año</strong>`;
  document.getElementById('f-calc-t').innerHTML = `T = 365 / ${N.toFixed(2)} = <strong>${T.toFixed(2)} días</strong>`;
  document.getElementById('f-calc-tc').innerHTML = `TC = (${D} / ${Q.toFixed(2)})&middot;${S} + (${Q.toFixed(2)} / 2)&middot;${H} = <strong>$${TC.toFixed(2)}/año</strong>`;
  document.getElementById('f-calc-rop').innerHTML = `ROP = (${D} / 365) &middot; ${L} = <strong>${ROP.toFixed(2)} unidades</strong>`;

  // Draw chart
  drawEoqChart(Q, D, S, H);
}

function drawEoqChart(optimalQ, D, S, H) {
  const canvas = document.getElementById('live-eoq-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Set dimensions based on wrapper size
  const parent = canvas.parentNode;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight || 220;

  const w = canvas.width;
  const h = canvas.height;
  const padLeft = 45;
  const padBottom = 30;
  const padTop = 15;
  const padRight = 15;
  
  ctx.clearRect(0, 0, w, h);
  
  // Generate curve coordinates
  const pointsCount = 50;
  const maxQ = optimalQ * 2.3;
  const minQ = optimalQ * 0.15;
  
  const qs = [];
  const carryingCosts = [];
  const orderingCosts = [];
  const totalCosts = [];
  
  for (let i = 0; i < pointsCount; i++) {
    const q = minQ + (maxQ - minQ) * (i / (pointsCount - 1));
    qs.push(q);
    
    const hold = (q / 2) * H;
    const order = (D / q) * S;
    carryingCosts.push(hold);
    orderingCosts.push(order);
    totalCosts.push(hold + order);
  }
  
  const maxCost = Math.max(...totalCosts) * 0.85;
  const minCost = 0;
  
  const getX = q => padLeft + ((q - minQ) / (maxQ - minQ)) * (w - padLeft - padRight);
  const getY = cost => h - padBottom - ((cost - minCost) / (maxCost - minCost)) * (h - padBottom - padTop);
  
  // Draw Grid Lines & Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  
  for (let i = 1; i <= 4; i++) {
    const yVal = getY(maxCost * (i / 4));
    ctx.beginPath();
    ctx.moveTo(padLeft, yVal);
    ctx.lineTo(w - padRight, yVal);
    ctx.stroke();
    
    ctx.fillStyle = '#6b7280';
    ctx.font = '8px monospace';
    ctx.fillText('$' + Math.round(maxCost * (i / 4)), 10, yVal + 3);
  }
  
  // Draw curves
  const drawCurve = (costs, color, width, dashed = false) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([4, 4]);
    else ctx.setLineDash([]);
    
    ctx.moveTo(getX(qs[0]), getY(costs[0]));
    for (let i = 1; i < pointsCount; i++) {
      ctx.lineTo(getX(qs[i]), getY(costs[i]));
    }
    ctx.stroke();
  };
  
  drawCurve(carryingCosts, '#bd00ff', 1.5, true);  // holding cost (purple)
  drawCurve(orderingCosts, '#ff5f56', 1.5, true);  // ordering cost (red)
  drawCurve(totalCosts, '#00f0ff', 2.5);            // total cost (cyan)
  
  // Optimal line helper
  const optX = getX(optimalQ);
  const optY = getY((optimalQ / 2) * H + (D / optimalQ) * S);
  
  // Draw optimal intersection lines
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.moveTo(optX, h - padBottom);
  ctx.lineTo(optX, optY);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(padLeft, optY);
  ctx.lineTo(optX, optY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw optimal dot
  ctx.fillStyle = '#00f0ff';
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#00f0ff';
  ctx.beginPath();
  ctx.arc(optX, optY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; // reset
  
  // Label X axis
  ctx.fillStyle = '#9ca3af';
  ctx.font = '9px sans-serif';
  ctx.fillText('Q* = ' + Math.round(optimalQ) + ' u', optX - 25, h - 8);
  
  // Draw Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, h - padBottom);
  ctx.lineTo(w - padRight, h - padBottom);
  ctx.stroke();
}

/* -------------------------------------------------------------
   6. MARKOV TRANSITION & STABLE STATES
   ------------------------------------------------------------- */
function initMarkovForm() {
  const sizeSelect = document.getElementById('markov-size');
  if (!sizeSelect) return;

  const rebuild = () => {
    const N = parseInt(sizeSelect.value);
    const container = document.getElementById('markov-matrix-container');
    if (container) {
      let tableHTML = `<table class="matrix-grid-table"><thead><tr><th></th>`;
      for (let j = 1; j <= N; j++) tableHTML += `<th>E${j}</th>`;
      tableHTML += `</tr></thead><tbody>`;

      const defaults = [
        [0.7, 0.2, 0.1, 0.0],
        [0.3, 0.5, 0.2, 0.0],
        [0.2, 0.3, 0.5, 0.0],
        [0.1, 0.1, 0.2, 0.6]
      ];

      for (let i = 1; i <= N; i++) {
        tableHTML += `<tr><th>E${i}</th>`;
        for (let j = 1; j <= N; j++) {
          let val = defaults[i - 1][j - 1];
          if (N === 2) {
            if (i === 1) val = (j === 1) ? 0.7 : 0.3;
            if (i === 2) val = (j === 1) ? 0.4 : 0.6;
          } else if (N === 4) {
            if (i === 1) val = (j === 1) ? 0.6 : (j === 2 ? 0.2 : (j === 3 ? 0.1 : 0.1));
            if (i === 2) val = (j === 1) ? 0.2 : (j === 2 ? 0.6 : (j === 3 ? 0.1 : 0.1));
            if (i === 3) val = (j === 1) ? 0.1 : (j === 2 ? 0.1 : (j === 3 ? 0.6 : 0.2));
            if (i === 4) val = (j === 1) ? 0.1 : (j === 2 ? 0.1 : (j === 3 ? 0.2 : 0.6));
          }
          tableHTML += `<td><input type="number" id="m-${i - 1}-${j - 1}" value="${val}" step="0.05" min="0" max="1" class="matrix-grid-input"></td>`;
        }
        tableHTML += `</tr>`;
      }
      tableHTML += `</tbody></table>`;
      container.innerHTML = tableHTML;
    }

    const initialContainer = document.getElementById('markov-initial-container');
    if (initialContainer) {
      initialContainer.innerHTML = '';
      for (let i = 1; i <= N; i++) {
        const val = (i === 1) ? 1.0 : 0.0;
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.style.margin = '0';
        formGroup.style.flex = '1';
        formGroup.style.minWidth = '70px';
        formGroup.innerHTML = `
          <label style="font-size:0.7rem; text-transform:none;">&pi;₀(E${i})</label>
          <input type="number" id="pi0-${i - 1}" value="${val}" step="0.1" min="0" max="1" class="solver-input" style="height:34px; padding:0 0.5rem; text-align:center;">
        `;
        initialContainer.appendChild(formGroup);
      }
    }
  };

  sizeSelect.addEventListener('change', () => {
    rebuild();
    solveMarkovModel();
  });
  rebuild();
}

function solveLinearSystem(A, b) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    A[i].push(b[i]);
  }
  
  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    const temp = A[maxRow];
    A[maxRow] = A[i];
    A[i] = temp;

    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j <= n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
    }
  }

  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = A[i][n] / A[i][i];
    for (let k = i - 1; k >= 0; k--) {
      A[k][n] -= A[k][i] * x[i];
    }
  }
  return x;
}

function multiplyVectorMatrix(v, M) {
  const n = v.length;
  const res = Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += v[i] * M[i][j];
    }
    res[j] = sum;
  }
  return res;
}

function multiplyMatrices(A, B) {
  const n = A.length;
  const C = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

function drawMarkovGraph(N, P) {
  const svg = document.getElementById('markov-svg');
  if (!svg) return;
  svg.innerHTML = '';
  
  let nodes = [];
  if (N === 2) {
    nodes = [
      { x: 120, y: 150, color: '#00f0ff', label: 'E₁' },
      { x: 280, y: 150, color: '#bd00ff', label: 'E₂' }
    ];
  } else if (N === 3) {
    nodes = [
      { x: 100, y: 100, color: '#00f0ff', label: 'E₁' },
      { x: 300, y: 100, color: '#bd00ff', label: 'E₂' },
      { x: 200, y: 230, color: '#0055ff', label: 'E₃' }
    ];
  } else {
    nodes = [
      { x: 100, y: 90, color: '#00f0ff', label: 'E₁' },
      { x: 300, y: 90, color: '#bd00ff', label: 'E₂' },
      { x: 300, y: 210, color: '#0055ff', label: 'E₃' },
      { x: 100, y: 210, color: '#ffbd2e', label: 'E₄' }
    ];
  }
  
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const prob = P[i][j];
      if (prob <= 0.01) continue;
      
      const nStart = nodes[i];
      const nEnd = nodes[j];
      let pathD = '';
      let textX = 0;
      let textY = 0;
      
      if (i === j) {
        const dx = nStart.x - 200;
        const dy = nStart.y - 150;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        
        const cp1_x = nStart.x + ux * 38 - uy * 18;
        const cp1_y = nStart.y + uy * 38 + ux * 18;
        const cp2_x = nStart.x + ux * 38 + uy * 18;
        const cp2_y = nStart.y + uy * 38 - ux * 18;
        
        pathD = `M ${nStart.x} ${nStart.y} C ${cp1_x} ${cp1_y}, ${cp2_x} ${cp2_y}, ${nStart.x} ${nStart.y}`;
        textX = nStart.x + ux * 48;
        textY = nStart.y + uy * 48 + 3;
      } else {
        const mx = (nStart.x + nEnd.x) / 2;
        const my = (nStart.y + nEnd.y) / 2;
        const dx = nEnd.x - nStart.x;
        const dy = nEnd.y - nStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        const offset = 18;
        const cx = mx + nx * offset;
        const cy = my + ny * offset;
        
        pathD = `M ${nStart.x} ${nStart.y} Q ${cx} ${cy} ${nEnd.x} ${nEnd.y}`;
        textX = cx + nx * 10;
        textY = cy + ny * 10 + 3;
      }
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('id', `path-${i}-${j}`);
      svg.appendChild(path);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', textX);
      text.setAttribute('y', textY);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'var(--text-gray-muted)');
      text.setAttribute('style', 'font-size: 8px; font-family: monospace; font-weight: bold;');
      text.textContent = prob.toFixed(2);
      svg.appendChild(text);
      
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', nEnd.color);
      dot.setAttribute('class', 'markov-flow-dot');
      dot.setAttribute('style', `filter: drop-shadow(0 0 4px ${nEnd.color});`);
      
      const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      anim.setAttribute('dur', (3.5 / prob).toFixed(1) + 's');
      anim.setAttribute('repeatCount', 'indefinite');
      anim.setAttribute('path', pathD);
      dot.appendChild(anim);
      
      svg.appendChild(dot);
    }
  }
  
  nodes.forEach(node => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', '22');
    circle.setAttribute('fill', '#08080c');
    circle.setAttribute('stroke', node.color);
    circle.setAttribute('stroke-width', '3');
    svg.appendChild(circle);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.x);
    text.setAttribute('y', node.y + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'markov-node-label');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('style', 'font-size: 11px; font-weight: bold;');
    text.textContent = node.label;
    svg.appendChild(text);
  });
}

function solveMarkovModel() {
  const sizeSelect = document.getElementById('markov-size');
  const stepsInput = document.getElementById('markov-steps');
  if (!sizeSelect || !stepsInput) return;

  const N = parseInt(sizeSelect.value);
  const k = Math.min(50, Math.max(1, parseInt(stepsInput.value) || 10));

  // 1. Read transition matrix P
  const P = [];
  const pInputs = [];
  for (let i = 0; i < N; i++) {
    const row = [];
    const rowInputs = [];
    let sum = 0;
    for (let j = 0; j < N; j++) {
      const inp = document.getElementById(`m-${i}-${j}`);
      rowInputs.push(inp);
      let val = inp ? (parseFloat(inp.value) || 0) : 0;
      row.push(val);
      sum += val;
    }
    P.push(row);
    
    if (Math.abs(sum - 1.0) > 0.02) {
      rowInputs.forEach(inp => {
        if (inp) {
          inp.style.borderColor = 'rgba(255, 95, 86, 0.5)';
          inp.style.boxShadow = '0 0 8px rgba(255, 95, 86, 0.1)';
        }
      });
    } else {
      rowInputs.forEach(inp => {
        if (inp) {
          inp.style.borderColor = '';
          inp.style.boxShadow = '';
        }
      });
    }
  }

  // 2. Read initial state vector pi0
  const pi0 = [];
  const pi0Inputs = [];
  let pi0Sum = 0;
  for (let i = 0; i < N; i++) {
    const inp = document.getElementById(`pi0-${i}`);
    pi0Inputs.push(inp);
    let val = inp ? (parseFloat(inp.value) || 0) : 0;
    pi0.push(val);
    pi0Sum += val;
  }

  if (Math.abs(pi0Sum - 1.0) > 0.02) {
    pi0Inputs.forEach(inp => {
      if (inp) {
        inp.style.borderColor = 'rgba(255, 95, 86, 0.5)';
        inp.style.boxShadow = '0 0 8px rgba(255, 95, 86, 0.1)';
      }
    });
  } else {
    pi0Inputs.forEach(inp => {
      if (inp) {
        inp.style.borderColor = '';
        inp.style.boxShadow = '';
      }
    });
  }

  // 3. Compute steady state probabilities exactly
  const M_eq = [];
  const B_eq = [];
  for (let j = 0; j < N - 1; j++) {
    const row = [];
    for (let i = 0; i < N; i++) {
      row.push(P[i][j] - (i === j ? 1 : 0));
    }
    M_eq.push(row);
    B_eq.push(0);
  }
  const normRow = Array(N).fill(1);
  M_eq.push(normRow);
  B_eq.push(1);

  let steadyState = null;
  try {
    steadyState = solveLinearSystem(M_eq, B_eq);
  } catch (err) {
    steadyState = null;
  }

  // Render stable state cards
  const output = document.getElementById('markov-steady-output');
  if (output) {
    if (steadyState && steadyState.every(v => !isNaN(v) && isFinite(v))) {
      let cardsHTML = `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">`;
      const colors = ['#00f0ff', '#bd00ff', '#0055ff', '#ffbd2e'];
      
      steadyState.forEach((val, idx) => {
        cardsHTML += `
          <div style="flex: 1; min-width: 80px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 0.5rem; text-align: center;">
            <div style="color: ${colors[idx % colors.length]}; font-size: 1.1rem; font-weight: bold; font-family: monospace;">${(val * 100).toFixed(1)}%</div>
            <div style="color: var(--text-gray-muted); font-size: 0.7rem;">E${idx + 1} (estable)</div>
          </div>
        `;
      });
      cardsHTML += `</div>`;
      
      let stateLabels = steadyState.map((val, idx) => `E${idx+1}=${(val*100).toFixed(1)}%`).join(', ');
      cardsHTML += `
        <div style="font-size: 0.75rem; color: var(--text-gray-light); line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.6rem; margin-top: 0.8rem;">
          <strong>💡 Estado estable alcanzado:</strong> ${stateLabels}. A largo plazo, independientemente del estado inicial, el sistema converge a estas probabilidades.
        </div>
      `;
      output.innerHTML = cardsHTML;
    } else {
      output.innerHTML = `<span style="color: #ffbd2e;">El sistema no posee un único estado estable.</span>`;
    }
  }

  // 4. Compute evolution history
  const history = [];
  history.push([...pi0]);
  let currentV = [...pi0];
  for (let t = 1; t <= k; t++) {
    currentV = multiplyVectorMatrix(currentV, P);
    history.push([...currentV]);
  }

  // Render evolution table
  const evolutionContainer = document.getElementById('markov-evolution-container');
  if (evolutionContainer) {
    let tableHTML = `
      <div class="simplex-table-wrapper" style="max-height: 380px; overflow-y: auto; background: rgba(5,5,5,0.45);">
        <table class="simplex-table tp-table" style="font-size: 0.8rem;">
          <thead>
            <tr>
              <th>Paso</th>
    `;
    for (let j = 1; j <= N; j++) tableHTML += `<th>E${j}</th>`;
    tableHTML += `</tr></thead><tbody>`;

    history.forEach((vec, step) => {
      let cells = `<td><strong>${step}</strong></td>`;
      for (let j = 0; j < N; j++) {
        cells += `<td style="font-family: monospace;">${(vec[j] * 100).toFixed(2)}%</td>`;
      }
      tableHTML += `<tr>${cells}</tr>`;
    });
    tableHTML += `</tbody></table></div>`;
    evolutionContainer.innerHTML = tableHTML;
  }

  drawMarkovGraph(N, P);
}

/* -------------------------------------------------------------
   7. GRAPHICAL METHOD 2D CHART RENDERER & SOLVER HELPERS
   ------------------------------------------------------------- */
function getIntersection(a1, b1, c1, a2, b2, c2) {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) return null; // parallel lines
  const x = (c1 * b2 - c2 * b1) / det;
  const y = (a1 * c2 - a2 * c1) / det;
  return { x, y };
}

function computeGraphicalSolution(optType, c, A, signs, b) {
  const numConst = A.length;
  
  // Find all intersections to scale bounds
  let points = [];
  const lines = [];
  for (let i = 0; i < numConst; i++) {
    lines.push({ a1: A[i][0], a2: A[i][1], b: b[i] });
  }
  lines.push({ a1: 1, a2: 0, b: 0 }); // x = 0
  lines.push({ a1: 0, a2: 1, b: 0 }); // y = 0
  
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const pt = getIntersection(lines[i].a1, lines[i].a2, lines[i].b, lines[j].a1, lines[j].a2, lines[j].b);
      if (pt && isFinite(pt.x) && isFinite(pt.y) && pt.x >= -1e-5 && pt.y >= -1e-5) {
        points.push(pt);
      }
    }
  }
  
  let xs = points.map(p => p.x).filter(x => x > 1e-5 && x < 1e6);
  let ys = points.map(p => p.y).filter(y => y > 1e-5 && y < 1e6);
  
  let maxX = xs.length > 0 ? Math.max(...xs) : 10;
  let maxY = ys.length > 0 ? Math.max(...ys) : 10;
  
  if (maxX > 1000) maxX = 100;
  if (maxY > 1000) maxY = 100;
  
  maxX = maxX * 1.35;
  maxY = maxY * 1.35;
  
  if (maxX < 1) maxX = 10;
  if (maxY < 1) maxY = 10;
  
  // Add viewport lines
  const viewportLines = [
    ...lines,
    { a1: 1, a2: 0, b: maxX },
    { a1: 0, a2: 1, b: maxY }
  ];
  
  const allCorners = [];
  for (let i = 0; i < viewportLines.length; i++) {
    for (let j = i + 1; j < viewportLines.length; j++) {
      const pt = getIntersection(viewportLines[i].a1, viewportLines[i].a2, viewportLines[i].b, viewportLines[j].a1, viewportLines[j].a2, viewportLines[j].b);
      if (pt && isFinite(pt.x) && isFinite(pt.y)) {
        allCorners.push(pt);
      }
    }
  }
  
  const isFeasible = (x, y) => {
    if (x < -1e-5 || y < -1e-5) return false;
    if (x > maxX + 1e-5 || y > maxY + 1e-5) return false;
    for (let i = 0; i < numConst; i++) {
      const val = A[i][0] * x + A[i][1] * y;
      if (signs[i] === '<=' && val > b[i] + 1e-5) return false;
      if (signs[i] === '>=' && val < b[i] - 1e-5) return false;
      if (signs[i] === '=' && Math.abs(val - b[i]) > 1e-5) return false;
    }
    return true;
  };
  
  const feasibleCorners = [];
  const seen = new Set();
  for (const pt of allCorners) {
    if (isFeasible(pt.x, pt.y)) {
      const key = `${pt.x.toFixed(4)},${pt.y.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        feasibleCorners.push(pt);
      }
    }
  }
  
  // If no feasible corner points, it's infeasible
  if (feasibleCorners.length === 0) {
    return { maxX, maxY, feasibleCorners, optimalPt: null, finalZ: 0, infeasible: true, unbounded: false };
  }
  
  // Find optimal point among feasible corners
  let optimalPt = null;
  let bestZ = optType === 'max' ? -Infinity : Infinity;
  
  feasibleCorners.forEach(pt => {
    const z = c[0] * pt.x + c[1] * pt.y;
    if (optType === 'max') {
      if (z > bestZ) {
        bestZ = z;
        optimalPt = pt;
      }
    } else {
      if (z < bestZ) {
        bestZ = z;
        optimalPt = pt;
      }
    }
  });
  
  // Check if unbounded
  let unbounded = false;
  if (optimalPt) {
    const onLimitX = Math.abs(optimalPt.x - maxX) < 1e-3;
    const onLimitY = Math.abs(optimalPt.y - maxY) < 1e-3;
    if (onLimitX || onLimitY) {
      unbounded = true;
    }
  }
  
  return {
    maxX,
    maxY,
    feasibleCorners,
    optimalPt,
    finalZ: bestZ,
    infeasible: false,
    unbounded
  };
}

function drawGraphicalMethod(canvasId, interpretationTextId, optType, numVars, numConst, c, A, signs, b, optimalValues, finalZ) {
  if (numVars !== 2) return;
  
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Set dimensions based on wrapper size
  const parent = canvas.parentNode;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight || 320;

  const w = canvas.width;
  const h = canvas.height;
  const padLeft = 45;
  const padBottom = 40;
  const padTop = 20;
  const padRight = 20;
  
  ctx.clearRect(0, 0, w, h);
  
  const sol = computeGraphicalSolution(optType, c, A, signs, b);
  const maxX = sol.maxX;
  const maxY = sol.maxY;
  const feasibleCorners = sol.feasibleCorners;
  const optimalPt = sol.optimalPt;
  const isUnbounded = sol.unbounded;
  const isInfeasible = sol.infeasible;

  // Coordinate transformations
  const getX = x => padLeft + (x / maxX) * (w - padLeft - padRight);
  const getY = y => h - padBottom - (y / maxY) * (h - padBottom - padTop);
  
  // Draw Grid Lines & Values
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280';
  ctx.font = '8px monospace';
  
  for (let i = 1; i <= 5; i++) {
    const gridXVal = maxX * (i / 5);
    const gridX = getX(gridXVal);
    ctx.beginPath();
    ctx.moveTo(gridX, padTop);
    ctx.lineTo(gridX, h - padBottom);
    ctx.stroke();
    ctx.fillText(gridXVal.toFixed(1), gridX - 8, h - padBottom + 12);
    
    const gridYVal = maxY * (i / 5);
    const gridY = getY(gridYVal);
    ctx.beginPath();
    ctx.moveTo(padLeft, gridY);
    ctx.lineTo(w - padRight, gridY);
    ctx.stroke();
    ctx.fillText(gridYVal.toFixed(1), padLeft - 26, gridY + 3);
  }
  
  // Fill Feasible Region Polygon
  if (!isInfeasible && feasibleCorners.length >= 3) {
    const cx = feasibleCorners.reduce((sum, p) => sum + p.x, 0) / feasibleCorners.length;
    const cy = feasibleCorners.reduce((sum, p) => sum + p.y, 0) / feasibleCorners.length;
    
    feasibleCorners.sort((p1, p2) => {
      const a1 = Math.atan2(p1.y - cy, p1.x - cx);
      const a2 = Math.atan2(p2.y - cy, p2.x - cx);
      return a1 - a2;
    });
    
    ctx.beginPath();
    ctx.moveTo(getX(feasibleCorners[0].x), getY(feasibleCorners[0].y));
    for (let i = 1; i < feasibleCorners.length; i++) {
      ctx.lineTo(getX(feasibleCorners[i].x), getY(feasibleCorners[i].y));
    }
    ctx.closePath();
    
    const gradient = ctx.createLinearGradient(padLeft, padTop, w, h);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(189, 0, 255, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  
  // Draw Constraint Lines
  for (let i = 0; i < numConst; i++) {
    const a1 = A[i][0];
    const a2 = A[i][1];
    const valB = b[i];
    
    let pStart, pEnd;
    
    if (Math.abs(a2) < 1e-9) {
      const xVal = valB / a1;
      pStart = { x: xVal, y: 0 };
      pEnd = { x: xVal, y: maxY };
    } else if (Math.abs(a1) < 1e-9) {
      const yVal = valB / a2;
      pStart = { x: 0, y: yVal };
      pEnd = { x: maxX, y: yVal };
    } else {
      const candidatePts = [
        { x: 0, y: valB / a2 },
        { x: valB / a1, y: 0 },
        { x: maxX, y: (valB - a1 * maxX) / a2 },
        { x: (valB - a2 * maxY) / a1, y: maxY }
      ].filter(p => p.x >= -1e-5 && p.x <= maxX + 1e-5 && p.y >= -1e-5 && p.y <= maxY + 1e-5);
      
      if (candidatePts.length >= 2) {
        pStart = candidatePts[0];
        pEnd = candidatePts[1];
      }
    }
    
    if (pStart && pEnd) {
      ctx.beginPath();
      ctx.moveTo(getX(pStart.x), getY(pStart.y));
      ctx.lineTo(getX(pEnd.x), getY(pEnd.y));
      
      const colors = ['#00f0ff', '#bd00ff', '#0055ff', '#ffbd2e'];
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = colors[i % colors.length];
      ctx.font = '9px monospace';
      const labelX = getX(pStart.x + (pEnd.x - pStart.x) * 0.7);
      const labelY = getY(pStart.y + (pEnd.y - pStart.y) * 0.7) - 4;
      ctx.fillText(`R${i+1}`, labelX, labelY);
    }
  }
  
  // Draw Z objective function line (dashed)
  if (optimalPt) {
    const c1 = c[0];
    const c2 = c[1];
    const zVal = sol.finalZ;
    
    let zStart, zEnd;
    if (Math.abs(c2) < 1e-9) {
      const zX = zVal / c1;
      zStart = { x: zX, y: 0 };
      zEnd = { x: zX, y: maxY };
    } else if (Math.abs(c1) < 1e-9) {
      const zY = zVal / c2;
      zStart = { x: 0, y: zY };
      zEnd = { x: maxX, y: zY };
    } else {
      const candidateZPts = [
        { x: 0, y: zVal / c2 },
        { x: zVal / c1, y: 0 },
        { x: maxX, y: (zVal - c1 * maxX) / c2 },
        { x: (zVal - c2 * maxY) / c1, y: maxY }
      ].filter(p => p.x >= -1e-5 && p.x <= maxX + 1e-5 && p.y >= -1e-5 && p.y <= maxY + 1e-5);
      
      if (candidateZPts.length >= 2) {
        zStart = candidateZPts[0];
        zEnd = candidateZPts[1];
      }
    }
    
    if (zStart && zEnd) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#27c93f';
      ctx.lineWidth = 1.5;
      ctx.moveTo(getX(zStart.x), getY(zStart.y));
      ctx.lineTo(getX(zEnd.x), getY(zEnd.y));
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#27c93f';
      ctx.font = 'italic 8px monospace';
      const zLabelX = getX(zStart.x + (zEnd.x - zStart.x) * 0.25) + 4;
      const zLabelY = getY(zStart.y + (zEnd.y - zStart.y) * 0.25) - 4;
      ctx.fillText(`Z óptima`, zLabelX, zLabelY);
    }
  }
  
  // Draw Optimal Dot
  if (optimalPt) {
    const oX = getX(optimalPt.x);
    const oY = getY(optimalPt.y);
    
    ctx.fillStyle = '#27c93f';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#27c93f';
    ctx.beginPath();
    ctx.arc(oX, oY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(oX, oY, 5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#27c93f';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(`Óptimo (${optimalPt.x.toFixed(2)}, ${optimalPt.y.toFixed(2)})`, oX + 8, oY - 4);
  }
  
  // Draw Main Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, h - padBottom);
  ctx.lineTo(w - padRight, h - padBottom);
  ctx.stroke();
  
  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('x₁', w - padRight - 15, h - padBottom + 20);
  ctx.fillText('x₂', padLeft - 15, padTop + 5);
  
  // Update interpretation text description
  const interpretationText = document.getElementById(interpretationTextId);
  if (interpretationText) {
    let html = "";
    if (isInfeasible) {
      html += `<div style="color:#ff5f56; font-weight:bold; margin-bottom: 8px;">⚠️ Sistema Infactible (Región Vacía)</div>`;
      html += `No hay un área donde se cumplan todas las restricciones simultáneamente.<br><br>`;
    } else {
      html += `El área sombreada representa la <strong>Región Factible</strong>.<br><br>`;
    }
    
    html += `Restricciones del sistema:<br>`;
    for (let i = 0; i < numConst; i++) {
      const colors = ['cyan', 'purple', 'blue', 'orange'];
      const colorName = colors[i % colors.length];
      const signLabel = signs[i] === '<=' ? '&le;' : (signs[i] === '>=' ? '&ge;' : '=');
      html += `<div style="margin: 2px 0;"><span style="display:inline-block; width:8px; height:8px; background:${colors[i%colors.length]}; border-radius:2px; margin-right:5px;"></span><strong>R${i+1}</strong>: ${A[i][0]}x₁ + ${A[i][1]}x₂ ${signLabel} ${b[i]}</div>`;
    }
    
    if (isInfeasible) {
      // no optimal point
    } else if (isUnbounded) {
      html += `<br><div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:6px; margin-top:6px; color:#ffbd2e; font-weight:bold;">⚠️ Región Factible No Acotada.</div>`;
      html += `El valor de Z puede crecer indefinidamente dentro de la dirección de optimización.`;
    } else if (optimalPt) {
      html += `<br><div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:6px; margin-top:6px;">El punto óptimo se ubica en <strong>x₁ = ${optimalPt.x.toFixed(2)}</strong>, <strong>x₂ = ${optimalPt.y.toFixed(2)}</strong>, alcanzando <strong>Z = ${sol.finalZ.toFixed(2)}</strong>.</div>`;
    }
    interpretationText.innerHTML = html;
  }
}

/* -------------------------------------------------------------
   8. DEDICATED GRAPHICAL METHOD TAB IMPLEMENTATION
   ------------------------------------------------------------- */
function initGraphicalForm() {
  const selectConst = document.getElementById('graphical-const-count');
  if (!selectConst) return;

  const rebuild = () => {
    const numConst = parseInt(selectConst.value);
    
    // Generate Objective Row (always 2 variables)
    const objRow = document.getElementById('graphical-obj-row');
    objRow.innerHTML = '';
    const objLabel = document.createElement('span');
    objLabel.className = 'var-term';
    objLabel.innerHTML = 'Z = &nbsp;';
    objRow.appendChild(objLabel);

    for (let j = 1; j <= 2; j++) {
      const cell = document.createElement('div');
      cell.className = 'coeff-cell';
      cell.innerHTML = `
        <input type="number" id="graphical-c-${j}" value="${j === 1 ? 3 : 5}" class="solver-input">
        <span class="var-term">x<sub>${j}</sub></span>
        ${j < 2 ? '<span class="var-term">&nbsp;+&nbsp;</span>' : ''}
      `;
      objRow.appendChild(cell);
    }

    // Generate Constraints
    const constContainer = document.getElementById('graphical-constraints-container');
    constContainer.innerHTML = '';

    for (let i = 1; i <= numConst; i++) {
      const row = document.createElement('div');
      row.className = 'constraint-row';
      
      let varsHTML = '';
      for (let j = 1; j <= 2; j++) {
        let defaultVal = 1;
        if (i === 1 && j === 1) defaultVal = 1;
        else if (i === 1 && j === 2) defaultVal = 0; // x1 <= 4
        else if (i === 2 && j === 1) defaultVal = 0;
        else if (i === 2 && j === 2) defaultVal = 2; // 2x2 <= 12
        else if (i === 3 && j === 1) defaultVal = 3;
        else if (i === 3 && j === 2) defaultVal = 2; // 3x1 + 2x2 <= 18
        else if (i === 4 && j === 1) defaultVal = 1;
        else if (i === 4 && j === 2) defaultVal = 1; // x1 + x2 <= 8

        varsHTML += `
          <div class="coeff-cell">
            <input type="number" id="graphical-a-${i}-${j}" value="${defaultVal}" class="solver-input">
            <span class="var-term">x<sub>${j}</sub></span>
            ${j < 2 ? '<span class="var-term">&nbsp;+&nbsp;</span>' : ''}
          </div>
        `;
      }

      let defaultRHS = 10;
      if (i === 1) defaultRHS = 4;
      else if (i === 2) defaultRHS = 12;
      else if (i === 3) defaultRHS = 18;
      else if (i === 4) defaultRHS = 8;

      row.innerHTML = `
        <span class="var-term" style="margin-right:0.5rem; color: var(--text-gray-dark);">[${i}]</span>
        ${varsHTML}
        <select id="graphical-sign-${i}" class="solver-select constraint-sign">
          <option value="<=" selected>&le;</option>
          <option value=">=">&ge;</option>
          <option value="=">=</option>
        </select>
        <input type="number" id="graphical-rhs-${i}" value="${defaultRHS}" class="solver-input" style="width: 60px; text-align:center; padding:0;">
      `;
      constContainer.appendChild(row);
    }
  };

  selectConst.addEventListener('change', rebuild);
  rebuild();
}

function solveGraphicalModel() {
  const optType = document.getElementById('graphical-opt-type').value;
  const numConst = parseInt(document.getElementById('graphical-const-count').value);
  const output = document.getElementById('graphical-output-area');
  
  if (!output) return;
  output.innerHTML = '<h3 style="color: var(--primary-cyan); margin-bottom:1rem;">Ejecutando algoritmo gráfico...</h3>';

  const c = [
    parseFloat(document.getElementById('graphical-c-1').value) || 0,
    parseFloat(document.getElementById('graphical-c-2').value) || 0
  ];

  const A = [];
  const signs = [];
  const b = [];
  for (let i = 1; i <= numConst; i++) {
    const a1 = parseFloat(document.getElementById(`graphical-a-${i}-1`).value) || 0;
    const a2 = parseFloat(document.getElementById(`graphical-a-${i}-2`).value) || 0;
    const sign = document.getElementById(`graphical-sign-${i}`).value;
    const rhs = parseFloat(document.getElementById(`graphical-rhs-${i}`).value) || 0;
    A.push([a1, a2]);
    signs.push(sign);
    b.push(rhs);
  }

  // Preprocess: RHS >= 0
  for (let i = 0; i < numConst; i++) {
    if (b[i] < 0) {
      b[i] = -b[i];
      A[i][0] = -A[i][0];
      A[i][1] = -A[i][1];
      if (signs[i] === '<=') signs[i] = '>=';
      else if (signs[i] === '>=') signs[i] = '<=';
    }
  }

  // Compute solution
  const sol = computeGraphicalSolution(optType, c, A, signs, b);
  
  let finalHTML = `
    <div class="iteration-tableau-card" style="border-color: var(--border-active);">
      <h4 style="color: var(--primary-cyan); font-size: 0.95rem; margin-bottom: 0.5rem;">Formulación del Problema</h4>
      <div style="font-family: monospace; font-size: 0.85rem; line-height: 1.5; padding: 0.8rem; background: rgba(0,0,0,0.3); border-radius: 6px;">
        <strong>Objetivo:</strong> ${optType === 'max' ? 'Max' : 'Min'} Z = ${c[0]}x₁ + ${c[1]}x₂<br>
        <strong>Sujeto a:</strong><br>
  `;
  for (let i = 0; i < numConst; i++) {
    const signLabel = signs[i] === '<=' ? '&le;' : (signs[i] === '>=' ? '&ge;' : '=');
    finalHTML += `&nbsp;&nbsp;[${i+1}] ${A[i][0]}x₁ + ${A[i][1]}x₂ ${signLabel} ${b[i]}<br>`;
  }
  finalHTML += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;x₁, x₂ &ge; 0`;
  finalHTML += `</div></div>`;

  if (sol.infeasible) {
    finalHTML += `
      <div class="optimal-solution-card" style="border-color: #ffbd2e; background: rgba(255,189,46,0.05); margin-top: 1rem;">
        <h4 style="color:#ffbd2e;">⚠️ Sistema Infactible</h4>
        <p style="font-size:0.85rem; line-height:1.5; color: var(--text-gray-light);">
          No existe una solución factible que cumpla con todas las restricciones del modelo de forma simultánea. La región factible es vacía.
        </p>
      </div>
    `;
  } else {
    // Generate vertices table HTML
    let tableRows = "";
    sol.feasibleCorners.forEach((pt, idx) => {
      const zVal = c[0] * pt.x + c[1] * pt.y;
      const isOpt = sol.optimalPt && Math.abs(pt.x - sol.optimalPt.x) < 1e-4 && Math.abs(pt.y - sol.optimalPt.y) < 1e-4;
      tableRows += `
        <tr class="${isOpt ? 'simplex-pivot-row' : ''}">
          <td><strong>V${idx + 1}</strong></td>
          <td>(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})</td>
          <td style="${isOpt ? 'color: #27c93f; font-weight: bold;' : ''}">${zVal.toFixed(2)}</td>
          <td>${isOpt ? '<span style="color:#27c93f; font-weight:bold;">🏆 ÓPTIMO</span>' : '<span style="color:var(--text-gray-muted);">Factible</span>'}</td>
        </tr>
      `;
    });

    finalHTML += `
      <div class="iteration-tableau-card" style="margin-top: 1rem;">
        <div class="simplex-iteration-title">
          <span>Evaluación de Vértices de la Región Factible</span>
        </div>
        <div class="simplex-table-wrapper">
          <table class="simplex-table">
            <thead>
              <tr>
                <th>Vértice</th>
                <th>Coordenadas (x₁, x₂)</th>
                <th>Z = ${c[0]}x₁ + ${c[1]}x₂</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (sol.unbounded) {
      finalHTML += `
        <div class="optimal-solution-card" style="border-color: #ff5f56; background: rgba(255,95,86,0.05); margin-top: 1rem;">
          <h4 style="color:#ff5f56;">⚠️ Solución Ilimitada</h4>
          <p style="font-size:0.85rem; line-height:1.5; color: var(--text-gray-light);">
            El problema no está acotado. El área factible se extiende infinitamente y el valor de Z puede mejorar de forma indefinida en la dirección óptima.
          </p>
        </div>
      `;
    } else if (sol.optimalPt) {
      finalHTML += `
        <div class="optimal-solution-card" style="margin-top: 1rem;">
          <h4>🏆 Solución Óptima Encontrada (Método Gráfico)</h4>
          <p style="font-size: 0.85rem; color: var(--text-gray-muted); margin-bottom: 0.8rem;">
            Al evaluar los vértices de la región factible, el óptimo se encuentra en el vértice:
          </p>
          <div class="optimal-vars-list">
            <div class="optimal-var-item">x₁ = <span>${sol.optimalPt.x.toFixed(2)}</span></div>
            <div class="optimal-var-item">x₂ = <span>${sol.optimalPt.y.toFixed(2)}</span></div>
            <div class="optimal-var-item" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:0.5rem; margin-top:0.3rem;">
              Valor Óptimo Z = <span style="color: #27c93f; font-size:1.15rem;">${sol.finalZ.toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Graphical Card
  finalHTML += `
    <div class="iteration-tableau-card" style="border-color: var(--primary-cyan); margin-top: 1.5rem;">
      <div class="simplex-iteration-title">
        <span>Solución Gráfica (Regiones Factibles)</span>
        <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-gray-dark);">[grafica-2d]</span>
      </div>
      <div class="simplex-graphical-layout" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; padding: 1.5rem; text-align: left;">
        <div style="position: relative; width: 100%; height: 320px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-light); border-radius: 8px; overflow: hidden; padding: 0.5rem;">
          <canvas id="live-graphical-canvas" style="width: 100%; height: 100%;"></canvas>
        </div>
        <div class="simplex-interpretation" style="margin: 0; display: flex; flex-direction: column; justify-content: center;">
          <strong>📈 Interpretación Gráfica:</strong><br>
          <div id="graphical-interpretation-text" style="font-size: 0.85rem; line-height: 1.5; color: var(--text-gray-light); margin-top: 0.5rem;"></div>
        </div>
      </div>
    </div>
  `;

  output.innerHTML = finalHTML;

  drawGraphicalMethod('live-graphical-canvas', 'graphical-interpretation-text', optType, 2, numConst, c, A, signs, b, sol.optimalPt ? { x1: sol.optimalPt.x, x2: sol.optimalPt.y } : null, sol.finalZ);
}

/* -------------------------------------------------------------
   9. INTERACTIVE BACKGROUND PARTICLES (CURSOR TRACKING)
   ------------------------------------------------------------- */
function initBackgroundParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-particles-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  const particles = [];
  const maxParticles = 65;
  let mouse = { x: w / 2, y: h / 2, active: false };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
    
    if (particles.length < maxParticles + 40 && Math.random() < 0.4) {
      particles.push(createParticle(mouse.x, mouse.y, true));
    }
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  const colors = [
    { r: 0, g: 240, b: 255 },  // Cyan
    { r: 189, g: 0, b: 255 },  // Purple
    { r: 0, g: 85, b: 255 }    // Blue
  ];

  function createParticle(x, y, isMouseTrail = false) {
    const col = colors[Math.floor(Math.random() * colors.length)];
    return {
      x: x || Math.random() * w,
      y: y || Math.random() * h,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      size: Math.random() * 2 + 0.6,
      alpha: isMouseTrail ? 0.95 : Math.random() * 0.45 + 0.1,
      decay: Math.random() * 0.012 + 0.006,
      r: col.r,
      g: col.g,
      b: col.b,
      isTrail: isMouseTrail
    };
  }

  for (let i = 0; i < maxParticles; i++) {
    particles.push(createParticle());
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (mouse.active) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const force = (180 - dist) / 180;
          p.vx += (dx / dist) * force * 0.03;
          p.vy += (dy / dist) * force * 0.03;
        }
      }

      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
        particles.splice(i, 1);
        if (!p.isTrail && particles.length < maxParticles) {
          particles.push(createParticle());
        }
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.alpha})`;
      if (p.isTrail) {
        ctx.shadowBlur = 3;
        ctx.shadowColor = `rgb(${p.r}, ${p.g}, ${p.b})`;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    requestAnimationFrame(animate);
  }

  animate();
}
