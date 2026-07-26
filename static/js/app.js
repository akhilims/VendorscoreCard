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

let staticStoreData = null;

async function loadStaticStore() {
  if (!staticStoreData) {
    try {
      const res = await fetch("data/store.json");
      staticStoreData = await res.json();
    } catch (e) {
      console.error("Could not fetch static store.json", e);
    }
  }
  return staticStoreData;
}

function computeClientVendorScore(vendorId, reviews) {
  const vReviews = (reviews || []).filter(r => r.vendor_id === vendorId);
  if (!vReviews.length) {
    return {
      score: 0.0,
      total_reviews: 0,
      status: "UNRATED",
      status_label: "No Ratings Yet",
      status_badge_class: "badge-neutral",
      breakdown: { quality: 0, punctuality: 0, staff_behavior: 0, responsiveness: 0, equipment: 0 }
    };
  }
  const total = vReviews.reduce((sum, r) => sum + (r.overall_rating || 4), 0);
  const avg = Math.round((total / vReviews.length) * 100) / 100;
  
  const qAvg = Math.round((vReviews.reduce((sum, r) => sum + (r.ratings ? r.ratings.quality : 4), 0) / vReviews.length) * 10) / 10;
  const pAvg = Math.round((vReviews.reduce((sum, r) => sum + (r.ratings ? r.ratings.punctuality : 4), 0) / vReviews.length) * 10) / 10;
  const bAvg = Math.round((vReviews.reduce((sum, r) => sum + (r.ratings ? r.ratings.staff_behavior : 4), 0) / vReviews.length) * 10) / 10;
  const rAvg = Math.round((vReviews.reduce((sum, r) => sum + (r.ratings ? r.ratings.responsiveness : 4), 0) / vReviews.length) * 10) / 10;
  const eAvg = Math.round((vReviews.reduce((sum, r) => sum + (r.ratings ? r.ratings.equipment : 4), 0) / vReviews.length) * 10) / 10;
  
  let statusKey = "KEEP", label = "Grade A - Retain Contract", badge = "badge-success";
  if (avg >= 4.0) { statusKey = "KEEP"; label = "Grade A - Retain Contract"; badge = "badge-success"; }
  else if (avg >= 3.2) { statusKey = "UNDER_REVIEW"; label = "Grade B - Satisfactory / Audit"; badge = "badge-info"; }
  else if (avg >= 2.5) { statusKey = "NOTICE"; label = "Grade C - Serve SLA Warning Notice"; badge = "badge-warning"; }
  else { statusKey = "TERMINATE"; label = "Grade D - Initiate Vendor Replacement"; badge = "badge-danger"; }

  return {
    score: avg,
    total_reviews: vReviews.length,
    status: statusKey,
    status_label: label,
    status_badge_class: badge,
    breakdown: { quality: qAvg, punctuality: pAvg, staff_behavior: bAvg, responsiveness: rAvg, equipment: eAvg }
  };
}

async function loadVendors() {
  try {
    const res = await fetch("/api/vendors");
    if (!res.ok) throw new Error("API not ok");
    const data = await res.json();
    allVendors = data.vendors;
  } catch (err) {
    console.log("GitHub Pages mode detected. Loading store.json directly...");
    const store = await loadStaticStore();
    if (store) {
      allVendors = store.vendors.map(v => ({
        ...v,
        metrics: computeClientVendorScore(v.id, store.reviews)
      }));
    }
  }
  renderVendorCards(allVendors);
  populateSLAVendorSelect(allVendors);
  document.getElementById("stat-total-vendors").innerText = allVendors.length;
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
  } catch (err) {
    const store = await loadStaticStore();
    if (store) {
      const overall = Math.round(((payload.ratings.quality + payload.ratings.punctuality + payload.ratings.staff_behavior + payload.ratings.responsiveness + payload.ratings.equipment) / 5) * 100) / 100;
      const newRev = {
        id: "rev-" + Math.random().toString(36).substr(2, 6),
        vendor_id: payload.vendor_id,
        resident_name: payload.resident_name,
        resident_email: payload.resident_email,
        flat_no: payload.flat_no,
        ratings: payload.ratings,
        overall_rating: overall,
        comment: payload.comment,
        created_at: new Date().toISOString()
      };
      store.reviews = store.reviews || [];
      store.reviews.push(newRev);
    }
  }

  alert(`🎉 Thank you! Your rating and comment for ${document.getElementById("rate-vendor-name").value} has been recorded.`);
  closeRateModal();
  loadVendors();
  loadAOAAnalytics();
}

/* REVIEWS MODAL */
async function openReviewsModal(vendorId) {
  let vName = "", vCat = "", score = 0, vReviews = [];
  try {
    const res = await fetch(`/api/vendors/${vendorId}/reviews`);
    if (!res.ok) throw new Error("API not ok");
    const data = await res.json();
    vName = data.vendor.name;
    vCat = data.vendor.category;
    score = data.metrics.score;
    vReviews = data.reviews;
  } catch (err) {
    const store = await loadStaticStore();
    const vendor = (store.vendors || []).find(v => v.id === vendorId);
    if (vendor) {
      vName = vendor.name;
      vCat = vendor.category;
      vReviews = (store.reviews || []).filter(r => r.vendor_id === vendorId);
      const metrics = computeClientVendorScore(vendorId, store.reviews);
      score = metrics.score;
    }
  }

  document.getElementById("view-modal-vendor-name").innerText = vName;
  document.getElementById("view-modal-vendor-cat").innerText = `${vCat} | Average Score: ⭐ ${score} / 5.0`;

  const container = document.getElementById("reviews-list-container");
  if (vReviews.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No resident comments recorded for this team yet. Be the first to evaluate!</p>`;
  } else {
    container.innerHTML = vReviews.map(r => `
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
}

function closeReviewsModal() {
  document.getElementById("modal-view-reviews").classList.remove("active");
}

/* AOA ANALYTICS & DECISION MATRIX */
async function loadAOAAnalytics() {
  let summary = null, allMetrics = [];
  try {
    const res = await fetch("/api/aoa/analytics");
    if (!res.ok) throw new Error("API not ok");
    const data = await res.json();
    summary = data.summary;
    allMetrics = data.all_vendor_metrics;
  } catch (err) {
    const store = await loadStaticStore();
    if (store) {
      let counts = { KEEP: 0, UNDER_REVIEW: 0, NOTICE: 0, TERMINATE: 0, UNRATED: 0 };
      let rated = [];
      allMetrics = store.vendors.map(v => {
        const m = computeClientVendorScore(v.id, store.reviews);
        counts[m.status] = (counts[m.status] || 0) + 1;
        if (m.total_reviews > 0) rated.push(m.score);
        return {
          vendor_name: v.name,
          category: v.category,
          parent_vendor: v.parent_vendor,
          contract_end: v.contract_end,
          score: m.score,
          total_reviews: m.total_reviews,
          status_label: m.status_label,
          status_badge_class: m.status_badge_class
        };
      });
      const avgSoc = rated.length ? Math.round((rated.reduce((a,b)=>a+b,0)/rated.length)*100)/100 : 3.85;
      summary = {
        avg_society_score: avgSoc,
        total_resident_reviews: (store.reviews || []).length,
        status_counts: counts
      };
    }
  }

  if (summary) {
    document.getElementById("stat-society-score").innerText = summary.avg_society_score;
    document.getElementById("stat-reviews-count").innerText = summary.total_resident_reviews;

    const counts = summary.status_counts;
    document.getElementById("cnt-keep").innerText = counts.KEEP || 0;
    document.getElementById("cnt-review").innerText = counts.UNDER_REVIEW || 0;
    document.getElementById("cnt-notice").innerText = counts.NOTICE || 0;
    document.getElementById("cnt-terminate").innerText = counts.TERMINATE || 0;
  }

  const tbody = document.querySelector("#aoa-matrix-table tbody");
  if (tbody && allMetrics.length) {
    tbody.innerHTML = allMetrics.map(vm => `
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
    if (!res.ok) throw new Error("API not ok");
    const data = await res.json();
    appendChatMessage(data.answer, "bot");
  } catch (err) {
    // Client side AI matching fallback
    const store = await loadStaticStore();
    let botReply = "";
    if (store && store.ai_knowledge) {
      const qLower = query.toLowerCase();
      let matched = null, maxKws = 0;
      for (const entry of store.ai_knowledge) {
        const matches = entry.keywords.filter(kw => qLower.includes(kw)).length;
        if (matches > maxKws) {
          maxKws = matches;
          matched = entry;
        }
      }
      if (matched && maxKws > 0) {
        botReply = matched.answer;
      }
    }
    if (!botReply) {
      botReply = `Hello Resident! I am your **Ace Divino AI Assistant** 🤖.\n\n` +
                 `I searched Ace Divino society records for: *"${query}"*.\n\n` +
                 `- **CityForce Security Desk**: Main Gate Ext 101 (+91 98112 34569)\n` +
                 `- **CBRE Maintenance Office**: Tower C Basement B1 (Ext 202)\n` +
                 `- **AOA Office**: Clubhouse Room 102 (aoa@acedivino.in)`;
    }
    appendChatMessage(botReply, "bot");
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
