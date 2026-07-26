// Ace Divino App Engine
let currentSSO = {
  name: "Dr. Ananya Roy",
  email: "ananya.roy@acedivino.in",
  flat: "Tower B-402",
  role: "Resident (B-402)"
};

let allVendors = [];
let activeCategoryFilter = "ALL";

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  updateSSODisplay();
  loadVendors();
  loadAOAAnalytics();
  loadSLAIncidents();
}

function updateSSODisplay() {
  document.getElementById("sso-user-email").innerText = currentSSO.email;
  document.getElementById("sso-user-role").innerText = currentSSO.role;
}

function switchSSOPersona() {
  const personas = [
    { name: "Dr. Ananya Roy", email: "ananya.roy@acedivino.in", flat: "Tower B-402", role: "Resident (B-402)" },
    { name: "Ramesh Chandra", email: "ramesh.chandra@acedivino.in", flat: "Tower C-1201", role: "Resident (C-1201)" },
    { name: "AOA President Desk", email: "aoa.president@acedivino.in", flat: "AOA Board Office", role: "AOA Board Member" },
    { name: "Vikram Rathore", email: "cbre.head@acedivino.in", flat: "B1 Estate Office", role: "Estate Manager" }
  ];

  const currentIdx = personas.findIndex(p => p.email === currentSSO.email);
  const nextIdx = (currentIdx + 1) % personas.length;
  currentSSO = personas[nextIdx];
  
  updateSSODisplay();
  alert(`SSO Persona Switched to: ${currentSSO.name} (${currentSSO.role})`);
}

function switchTab(tabId, btnElement) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");
  btnElement.classList.add("active");

  if (tabId === "tab-aoa-board") loadAOAAnalytics();
  if (tabId === "tab-sla-log") loadSLAIncidents();
}

async function loadVendors() {
  try {
    const res = await fetch("/api/vendors");
    const data = await res.json();
    allVendors = data.vendors;

    renderVendorCards(allVendors);
    populateSLAVendorSelect(allVendors);
    
    // Update summary stats
    document.getElementById("stat-total-vendors").innerText = allVendors.length;
  } catch (err) {
    console.error("Failed to load vendors:", err);
  }
}

function openPropertyModal() {
  const modal = document.getElementById("modal-property-showcase");
  if (modal) modal.classList.add("active");
}

function closePropertyModal() {
  const modal = document.getElementById("modal-property-showcase");
  if (modal) modal.classList.remove("active");
}

function renderVendorCards(vendors) {
  const container = document.getElementById("vendor-grid-container");
  container.innerHTML = "";

  let filtered = vendors.filter(v => {
    if (activeCategoryFilter === "CITYFORCE") return v.id.includes("cityforce") || v.name.toLowerCase().includes("cityforce");
    if (activeCategoryFilter === "CBRE") return v.id.startsWith("cbre") || v.parent_vendor === "cbre-main";
    if (activeCategoryFilter === "INDEPENDENT") return v.parent_vendor === null && !v.id.startsWith("cbre");
    if (activeCategoryFilter === "KEEP") return v.metrics.status === "KEEP";
    if (activeCategoryFilter === "NOTICE") return v.metrics.status === "NOTICE" || v.metrics.status === "TERMINATE";
    return true;
  });

  const query = document.getElementById("search-input").value.toLowerCase();
  if (query) {
    filtered = filtered.filter(v => 
      v.name.toLowerCase().includes(query) || 
      v.category.toLowerCase().includes(query) ||
      (v.description && v.description.toLowerCase().includes(query))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
      <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--gold-primary); margin-bottom: 1rem;"></i>
      <p>No vendor teams found matching the selected filter.</p>
    </div>`;
    return;
  }

  filtered.forEach(v => {
    const m = v.metrics;
    let parentHtml = "";
    if (v.id.includes("cityforce") || v.name.toLowerCase().includes("cityforce")) {
      parentHtml = `<span class="parent-tag" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.5); color: #34D399;"><i class="fa-solid fa-shield-halved"></i> CityForce Security Partner</span>`;
    } else if (v.parent_vendor) {
      parentHtml = `<span class="parent-tag"><i class="fa-solid fa-link"></i> ${v.parent_vendor === 'cbre-main' ? 'CBRE Sub-team' : 'Sub-contracted under CBRE'}</span>`;
    } else {
      parentHtml = `<span class="parent-tag" style="background: rgba(212,175,55,0.15); border-color: var(--border-gold); color: var(--gold-light);"><i class="fa-solid fa-building-user"></i> Independent Vendor</span>`;
    }

    const starsHtml = getStarIcons(m.score);

    const card = document.createElement("div");
    card.className = "vendor-card";
    card.innerHTML = `
      <div>
        <div class="vendor-card-header">
          <div>
            <h3 class="vendor-title">${v.name}</h3>
            <div class="vendor-category">${v.category}</div>
            ${parentHtml}
          </div>
          <div class="score-badge-large">
            <div class="score-num">${m.score > 0 ? m.score : 'N/A'}</div>
            <div class="score-stars">${starsHtml}</div>
          </div>
        </div>

        <p class="vendor-desc">${v.description}</p>

        <div style="margin-bottom: 0.8rem;">
          <span class="status-badge ${m.status_badge_class}">${m.status_label}</span>
          <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 8px;">(${m.total_reviews} Resident Reviews)</span>
        </div>

        <div class="metrics-row">
          <div>
            <div class="metric-col-lbl">Quality</div>
            <div class="metric-col-val">${m.breakdown.quality}</div>
          </div>
          <div>
            <div class="metric-col-lbl">Punctual</div>
            <div class="metric-col-val">${m.breakdown.punctuality}</div>
          </div>
          <div>
            <div class="metric-col-lbl">Behavior</div>
            <div class="metric-col-val">${m.breakdown.staff_behavior}</div>
          </div>
          <div>
            <div class="metric-col-lbl">Resp</div>
            <div class="metric-col-val">${m.breakdown.responsiveness}</div>
          </div>
          <div>
            <div class="metric-col-lbl">Equip</div>
            <div class="metric-col-val">${m.breakdown.equipment}</div>
          </div>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn-primary" onclick="openRateModal('${v.id}')">
          <i class="fa-solid fa-star"></i> Rate Team
        </button>
        <button class="btn-outline" onclick="openReviewsModal('${v.id}')">
          <i class="fa-solid fa-comments"></i> Reviews (${m.total_reviews})
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function getStarIcons(score) {
  const full = Math.floor(score);
  let stars = "";
  for (let i = 0; i < 5; i++) {
    if (i < full) stars += "★";
    else stars += "☆";
  }
  return stars;
}

function setCategoryFilter(cat, btn) {
  activeCategoryFilter = cat;
  document.querySelectorAll(".pill-filter").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderVendorCards(allVendors);
}

function filterVendors() {
  renderVendorCards(allVendors);
}

/* RATING MODAL & COMPULSORY COMMENT VALIDATION */
function openRateModal(vendorId) {
  const vendor = allVendors.find(v => v.id === vendorId);
  if (!vendor) return;

  document.getElementById("rate-vendor-id").value = vendor.id;
  document.getElementById("rate-vendor-name").value = vendor.name;
  document.getElementById("rate-resident-email").value = currentSSO.email;
  document.getElementById("rate-resident-flat").value = currentSSO.flat;
  document.getElementById("rate-comment").value = "";
  document.getElementById("rate-error-box").style.display = "none";

  // Reset star pickers to 4 default
  ["quality", "punctuality", "staff_behavior", "responsiveness", "equipment"].forEach(metric => {
    setStarValue(metric, 4);
  });

  document.getElementById("modal-rate-vendor").classList.add("active");
}

function closeRateModal() {
  document.getElementById("modal-rate-vendor").classList.remove("active");
}

function setStarValue(metric, val) {
  const picker = document.getElementById(`stars-${metric}`);
  picker.setAttribute("data-value", val);

  const stars = picker.querySelectorAll(".star");
  stars.forEach((star, index) => {
    if (index < val) star.classList.add("selected");
    else star.classList.remove("selected");
  });
}

async function handleRatingSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById("rate-error-box");
  errorBox.style.display = "none";

  const vendorId = document.getElementById("rate-vendor-id").value;
  const flatNo = document.getElementById("rate-resident-flat").value.trim();
  const comment = document.getElementById("rate-comment").value.trim();

  // Frontend compulsory comment check
  if (comment.length < 10) {
    errorBox.innerText = "❌ Compulsory Rule: A detailed feedback comment (minimum 10 characters) is required to evaluate a vendor.";
    errorBox.style.display = "block";
    return;
  }

  const payload = {
    vendor_id: vendorId,
    resident_name: currentSSO.name,
    resident_email: currentSSO.email,
    flat_no: flatNo,
    ratings: {
      quality: parseInt(document.getElementById("stars-quality").getAttribute("data-value")),
      punctuality: parseInt(document.getElementById("stars-punctuality").getAttribute("data-value")),
      staff_behavior: parseInt(document.getElementById("stars-staff_behavior").getAttribute("data-value")),
      responsiveness: parseInt(document.getElementById("stars-responsiveness").getAttribute("data-value")),
      equipment: parseInt(document.getElementById("stars-equipment").getAttribute("data-value"))
    },
    comment: comment
  };

  try {
    const res = await fetch("/api/vendors/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      errorBox.innerText = `❌ ${data.detail || 'Submission failed.'}`;
      errorBox.style.display = "block";
      return;
    }

    alert(`🎉 Thank you! Your rating and comment for ${document.getElementById("rate-vendor-name").value} has been recorded.`);
    closeRateModal();
    loadVendors();
    loadAOAAnalytics();
  } catch (err) {
    errorBox.innerText = "❌ Network error occurred while submitting rating.";
    errorBox.style.display = "block";
  }
}

/* REVIEWS MODAL */
async function openReviewsModal(vendorId) {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/reviews`);
    const data = await res.json();

    document.getElementById("view-modal-vendor-name").innerText = data.vendor.name;
    document.getElementById("view-modal-vendor-cat").innerText = `${data.vendor.category} | Average Score: ⭐ ${data.metrics.score} / 5.0`;

    const container = document.getElementById("reviews-list-container");
    if (data.reviews.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No resident comments recorded for this team yet. Be the first to evaluate!</p>`;
    } else {
      container.innerHTML = data.reviews.map(r => `
        <div class="review-item">
          <div class="review-header">
            <strong>${r.resident_name} (${r.flat_no})</strong>
            <span style="color: #FBBF24;">⭐ ${r.overall_rating} / 5.0</span>
          </div>
          <p class="review-text">"${r.comment}"</p>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: space-between;">
            <span><i class="fa-regular fa-clock"></i> ${new Date(r.created_at).toLocaleDateString()}</span>
            <span>Q:${r.ratings.quality} | P:${r.ratings.punctuality} | B:${r.ratings.staff_behavior} | R:${r.ratings.responsiveness} | E:${r.ratings.equipment}</span>
          </div>
        </div>
      `).join("");
    }

    document.getElementById("modal-view-reviews").classList.add("active");
  } catch (err) {
    console.error("Failed to load reviews:", err);
  }
}

function closeReviewsModal() {
  document.getElementById("modal-view-reviews").classList.remove("active");
}

/* AOA ANALYTICS & DECISION MATRIX */
async function loadAOAAnalytics() {
  try {
    const res = await fetch("/api/aoa/analytics");
    const data = await res.json();

    document.getElementById("stat-society-score").innerText = data.summary.avg_society_score;
    document.getElementById("stat-reviews-count").innerText = data.summary.total_resident_reviews;

    const counts = data.summary.status_counts;
    document.getElementById("cnt-keep").innerText = counts.KEEP || 0;
    document.getElementById("cnt-review").innerText = counts.UNDER_REVIEW || 0;
    document.getElementById("cnt-notice").innerText = counts.NOTICE || 0;
    document.getElementById("cnt-terminate").innerText = counts.TERMINATE || 0;

    const tbody = document.querySelector("#aoa-matrix-table tbody");
    tbody.innerHTML = data.all_vendor_metrics.map(vm => `
      <tr>
        <td><strong>${vm.vendor_name}</strong></td>
        <td><span style="font-size: 0.8rem; color: var(--gold-primary);">${vm.category}</span></td>
        <td>${vm.parent_vendor ? `<span style="font-size: 0.75rem; color: #60A5FA;">Sub-team (${vm.parent_vendor})</span>` : 'Direct AOA'}</td>
        <td><strong style="color: var(--gold-light);">⭐ ${vm.score > 0 ? vm.score : 'N/A'}</strong></td>
        <td>${vm.total_reviews}</td>
        <td>${vm.contract_end}</td>
        <td><span class="status-badge ${vm.status_badge_class}">${vm.status_label}</span></td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Failed to load AOA analytics:", err);
  }
}

/* ACE AI CHATBOT ENGINE */
async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const query = input.value.trim();
  if (!query) return;

  appendChatMessage(query, "user");
  input.value = "";

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query })
    });
    const data = await res.json();
    appendChatMessage(data.answer, "bot");
  } catch (err) {
    appendChatMessage("Sorry, I encountered an issue connecting to Ace Divino AI server.", "bot");
  }
}

function askAIChat(queryText) {
  document.getElementById("chat-input").value = queryText;
  handleChatSubmit(new Event("submit"));
}

function appendChatMessage(text, sender) {
  const container = document.getElementById("chat-messages-box");
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${sender}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

/* SLA INCIDENT TRACKER */
function populateSLAVendorSelect(vendors) {
  const select = document.getElementById("sla-vendor-select");
  if (!select) return;
  select.innerHTML = vendors.map(v => `<option value="${v.id}">${v.name} (${v.category})</option>`).join("");
}

async function loadSLAIncidents() {
  try {
    const res = await fetch("/api/sla/incidents");
    const data = await res.json();
    const tbody = document.querySelector("#sla-incidents-table tbody");
    
    if (data.incidents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No SLA breaches logged.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.incidents.map(inc => `
      <tr>
        <td><code>${inc.id}</code></td>
        <td><strong>${inc.vendor_name || inc.vendor_id}</strong></td>
        <td>${inc.title}</td>
        <td>${inc.reported_by} (${inc.flat})</td>
        <td><span class="status-badge ${inc.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${inc.severity}</span></td>
        <td>${new Date(inc.created_at).toLocaleDateString()}</td>
        <td><span class="status-badge badge-info">${inc.status}</span></td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Failed to load SLA incidents:", err);
  }
}

function openSLAIncidentModal() {
  document.getElementById("sla-flat").value = currentSSO.flat;
  document.getElementById("modal-sla-incident").classList.add("active");
}

function closeSLAModal() {
  document.getElementById("modal-sla-incident").classList.remove("active");
}

async function handleSLASubmit(e) {
  e.preventDefault();
  const payload = {
    vendor_id: document.getElementById("sla-vendor-select").value,
    title: document.getElementById("sla-title").value.trim(),
    reported_by: currentSSO.email,
    flat: document.getElementById("sla-flat").value.trim(),
    severity: document.getElementById("sla-severity").value,
    description: document.getElementById("sla-desc").value.trim()
  };

  try {
    const res = await fetch("/api/sla/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert("⚠️ SLA Incident Breach logged successfully. AOA Board notified!");
      closeSLAModal();
      loadSLAIncidents();
    }
  } catch (err) {
    alert("Failed to log incident.");
  }
}

function exportAOAReport() {
  window.print();
}
