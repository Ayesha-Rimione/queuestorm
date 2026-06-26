/* ============================================================
   QUEUESTORM INVESTIGATOR — script.js
   Handles: API health check, form submission, loading animation,
   result rendering, copy-to-clipboard, raw JSON toggle
   ============================================================ */

const BASE_URL = 'https://queuestorm-dkli.onrender.com';

// ── SAMPLE DATA (from sample_output.json) ──────────────────

const SAMPLE_INPUT = {
  ticket_id: 'TKT-001',
  complaint: 'I sent 5000 taka to a wrong number around 2pm today',
  language: 'en',
  channel: 'in_app_chat',
  user_type: 'customer',
  campaign_context: 'boishakh_bonanza_day_1',
  transaction_history: [
    {
      transaction_id: 'TXN-9101',
      timestamp: '2026-04-14T14:08:22Z',
      type: 'transfer',
      amount: 5000,
      counterparty: '+8801719876543',
      status: 'completed'
    }
  ]
};

// ── DOM REFS ────────────────────────────────────────────────

const statusDot   = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');

const ticketForm      = document.getElementById('ticketForm');
const ticketIdInput   = document.getElementById('ticketId');
const complaintInput  = document.getElementById('complaint');
const languageInput   = document.getElementById('language');
const channelInput    = document.getElementById('channel');
const userTypeInput   = document.getElementById('userType');
const campaignInput   = document.getElementById('campaignContext');
const txHistoryInput  = document.getElementById('txHistory');

const formError     = document.getElementById('formError');
const analyzeBtn    = document.getElementById('analyzeBtn');
const analyzeLabel  = analyzeBtn.querySelector('.btn-label');
const analyzeSpinner= document.getElementById('analyzeSpinner');

const emptyState    = document.getElementById('emptyState');
const loadingState  = document.getElementById('loadingState');
const resultsPanel  = document.getElementById('resultsPanel');

// Loading steps
const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3'),
  document.getElementById('step4'),
];

// Result fields
const resultTicketId   = document.getElementById('resultTicketId');
const resultTimestamp  = document.getElementById('resultTimestamp');
const verdictBar       = document.getElementById('verdictBar');
const verdictBadge     = document.getElementById('verdictBadge');
const severityChip     = document.getElementById('severityChip');
const humanReviewChip  = document.getElementById('humanReviewChip');
const statDepartment   = document.getElementById('statDepartment');
const statCaseType     = document.getElementById('statCaseType');
const statTransaction  = document.getElementById('statTransaction');
const confidencePct    = document.getElementById('confidencePct');
const confidenceBar    = document.getElementById('confidenceBar');
const agentSummary     = document.getElementById('agentSummary');
const recommendedAction= document.getElementById('recommendedAction');
const customerReply    = document.getElementById('customerReply');
const reasonCodes      = document.getElementById('reasonCodes');
const rawJson          = document.getElementById('rawJson');
const rawJsonBody      = document.getElementById('rawJsonBody');
const rawArrow         = document.getElementById('rawArrow');

// ── HEALTH CHECK ────────────────────────────────────────────

async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      setStatus('online', 'API Online');
    } else {
      setStatus('offline', 'API Error');
    }
  } catch {
    setStatus('offline', 'Unreachable');
  }
}

function setStatus(state, label) {
  statusDot.className = 'status-dot ' + state;
  statusLabel.textContent = label;
}

// ── PANEL SWITCHING ─────────────────────────────────────────

function showPanel(panel) {
  emptyState.classList.add('hidden');
  loadingState.classList.add('hidden');
  resultsPanel.classList.add('hidden');

  if (panel === 'empty')   emptyState.classList.remove('hidden');
  if (panel === 'loading') loadingState.classList.remove('hidden');
  if (panel === 'results') resultsPanel.classList.remove('hidden');
}

// ── LOADING STEP ANIMATION ──────────────────────────────────

let stepTimer = null;

function startLoadingSteps() {
  steps.forEach(s => s.className = 'loading-step');
  steps[0].classList.add('active');

  let current = 0;
  stepTimer = setInterval(() => {
    if (current < steps.length) {
      steps[current].classList.remove('active');
      steps[current].classList.add('done');
      current++;
      if (current < steps.length) {
        steps[current].classList.add('active');
      }
    }
  }, 900);
}

function stopLoadingSteps() {
  clearInterval(stepTimer);
  // Mark remaining as done
  steps.forEach(s => {
    s.classList.remove('active');
    s.classList.add('done');
  });
}

// ── FORM VALIDATION ─────────────────────────────────────────

function showError(msg) {
  formError.textContent = msg;
  formError.classList.add('visible');
}

function clearError() {
  formError.textContent = '';
  formError.classList.remove('visible');
}

function setLoading(on) {
  if (on) {
    analyzeLabel.classList.add('hidden');
    analyzeSpinner.classList.remove('hidden');
    analyzeBtn.disabled = true;
  } else {
    analyzeLabel.classList.remove('hidden');
    analyzeSpinner.classList.add('hidden');
    analyzeBtn.disabled = false;
  }
}

// ── FORM SUBMIT ─────────────────────────────────────────────

ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const ticketId  = ticketIdInput.value.trim();
  const complaint = complaintInput.value.trim();

  if (!ticketId) { showError('Ticket ID is required.'); ticketIdInput.focus(); return; }
  if (!complaint) { showError('Complaint cannot be empty.'); complaintInput.focus(); return; }

  // Parse optional transaction history JSON
  let txHistory = [];
  const txRaw = txHistoryInput.value.trim();
  if (txRaw) {
    try {
      txHistory = JSON.parse(txRaw);
      if (!Array.isArray(txHistory)) throw new Error('Must be a JSON array.');
    } catch (err) {
      showError('Transaction History must be a valid JSON array. ' + err.message);
      txHistoryInput.focus();
      return;
    }
  }

  const payload = {
    ticket_id:           ticketId,
    complaint:           complaint,
    language:            languageInput.value,
    channel:             channelInput.value,
    user_type:           userTypeInput.value,
    campaign_context:    campaignInput.value.trim() || 'none',
    transaction_history: txHistory,
  };

  setLoading(true);
  showPanel('loading');
  startLoadingSteps();

  try {
    const res = await fetch(`${BASE_URL}/analyze-ticket`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();
    stopLoadingSteps();

    if (!res.ok) {
      showPanel('empty');
      showError(data.error || `Server error (${res.status}). Please try again.`);
      return;
    }

    renderResults(data);
    showPanel('results');

  } catch (err) {
    stopLoadingSteps();
    showPanel('empty');
    showError('Could not reach the API. Check your connection and try again.');
  } finally {
    setLoading(false);
  }
});

// ── RENDER RESULTS ──────────────────────────────────────────

function fmt(str) {
  if (!str) return '—';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderResults(data) {
  // Header
  resultTicketId.textContent = data.ticket_id || '—';
  resultTimestamp.textContent = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // Verdict bar
  const verdict = data.evidence_verdict || 'insufficient_data';
  const verdictKey = verdict === 'insufficient_data' ? 'insufficient' : verdict;
  verdictBar.className = `verdict-bar verdict-${verdictKey}`;

  const verdictIcons = {
    consistent:        '✓',
    inconsistent:      '✕',
    insufficient_data: '?',
  };
  const verdictLabels = {
    consistent:        'Consistent',
    inconsistent:      'Inconsistent',
    insufficient_data: 'Insufficient Data',
  };

  verdictBadge.className = `verdict-badge badge-${verdictKey}`;
  verdictBadge.textContent = `${verdictIcons[verdict] || '?'} ${verdictLabels[verdict] || fmt(verdict)}`;

  // Severity chip
  const sev = (data.severity || 'medium').toLowerCase();
  severityChip.className = `meta-chip chip-${sev}`;
  severityChip.textContent = fmt(sev);

  // Human review chip
  const needsReview = data.human_review_required;
  humanReviewChip.className = `meta-chip ${needsReview ? 'chip-review-yes' : 'chip-review-no'}`;
  humanReviewChip.textContent = needsReview ? '⚠ Human Review Required' : '✓ No Human Review';

  // Stats row
  statDepartment.textContent  = fmt(data.department)  || '—';
  statCaseType.textContent    = fmt(data.case_type)    || '—';
  statTransaction.textContent = data.relevant_transaction_id || 'None';

  // Confidence
  const conf = typeof data.confidence === 'number' ? data.confidence : 0;
  const pct  = Math.round(conf * 100);
  confidencePct.textContent = `${pct}%`;

  const barEl = confidenceBar;
  barEl.className = 'confidence-bar-fill';
  if (conf < 0.4)      barEl.classList.add('bar-low');
  else if (conf < 0.75) barEl.classList.add('bar-medium');
  else                  barEl.classList.add('bar-high');

  // Animate bar after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { barEl.style.width = `${pct}%`; });
  });

  // Text cards
  agentSummary.textContent      = data.agent_summary            || '—';
  recommendedAction.textContent = data.recommended_next_action  || '—';
  customerReply.textContent     = data.customer_reply           || '—';

  // Reason codes
  const codes = Array.isArray(data.reason_codes) ? data.reason_codes : [];
  if (codes.length) {
    reasonCodes.innerHTML = codes
      .map(c => `<span class="reason-chip">${escapeHtml(c)}</span>`)
      .join('');
  } else {
    reasonCodes.innerHTML = '<span class="reason-empty">No reason codes returned.</span>';
  }

  // Raw JSON
  rawJson.textContent = JSON.stringify(data, null, 2);
  rawJsonBody.classList.add('hidden');
  rawArrow.classList.remove('open');
}

// ── COPY REPLY ──────────────────────────────────────────────

function copyReply() {
  const text = customerReply.textContent;
  if (!text || text === '—') return;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyReplyBtn');
    btn.classList.add('copied');
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copied!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/>
          <path d="M8 4V2a1 1 0 00-1-1H2a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="currentColor" stroke-width="1.2"/>
        </svg>
        Copy`;
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// ── RAW JSON TOGGLE ─────────────────────────────────────────

function toggleRaw() {
  const isHidden = rawJsonBody.classList.toggle('hidden');
  rawArrow.classList.toggle('open', !isHidden);
}

// ── LOAD SAMPLE ─────────────────────────────────────────────

document.getElementById('loadSampleBtn').addEventListener('click', () => {
  ticketIdInput.value  = SAMPLE_INPUT.ticket_id;
  complaintInput.value = SAMPLE_INPUT.complaint;
  languageInput.value  = SAMPLE_INPUT.language;
  channelInput.value   = SAMPLE_INPUT.channel;
  userTypeInput.value  = SAMPLE_INPUT.user_type;
  campaignInput.value  = SAMPLE_INPUT.campaign_context;
  txHistoryInput.value = JSON.stringify(SAMPLE_INPUT.transaction_history, null, 2);
  clearError();

  // Visual feedback: briefly highlight the form
  ticketForm.style.transition = 'opacity .15s';
  ticketForm.style.opacity = '0.6';
  setTimeout(() => { ticketForm.style.opacity = '1'; }, 150);
});

// ── CLEAR FORM ──────────────────────────────────────────────

document.getElementById('clearBtn').addEventListener('click', () => {
  ticketIdInput.value  = '';
  complaintInput.value = '';
  languageInput.value  = 'en';
  channelInput.value   = 'in_app_chat';
  userTypeInput.value  = 'customer';
  campaignInput.value  = '';
  txHistoryInput.value = '';
  clearError();
  showPanel('empty');
});

// ── HELPERS ─────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT ────────────────────────────────────────────────────

checkHealth();
// Re-check every 60 seconds
setInterval(checkHealth, 60000);