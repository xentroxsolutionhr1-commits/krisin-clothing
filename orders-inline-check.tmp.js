
    (function () {
      const STAGES = [
        "Order Placed",
        "Order Confirmed",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered"
      ];

      let allOrders = [];
      let currentFilter = "all";
      let searchQuery = "";
      let activeCancelOrderId = null;

      const unauthView = document.getElementById("unauth-view");
      const authView = document.getElementById("auth-view");
      const ordersList = document.getElementById("orders-list");
      const ordersLoading = document.getElementById("orders-loading");
      const ordersEmpty = document.getElementById("orders-empty");
      const filterTabs = document.getElementById("filter-tabs");
      const searchInput = document.getElementById("order-search-input");

      // Modal elements
      const detailsModal = document.getElementById("order-details-modal");
      const cancelModal = document.getElementById("cancel-confirm-modal");

      // Check URL parameters for direct order linking
      const urlParams = new URLSearchParams(window.location.search);
      const targetOrderId = urlParams.get("orderId");

      // 1. Initial Auth Check
      if (!AUTH.isCustomerLoggedIn()) {
        unauthView.classList.remove("hidden");
        authView.classList.add("hidden");
        ordersList.innerHTML = "";
        allOrders = [];
        return;
      }

      unauthView.classList.add("hidden");
      authView.classList.remove("hidden");

      // 2. Fetch Orders from Backend
      async function loadOrders() {
        ordersLoading.classList.remove("hidden");
        ordersEmpty.classList.add("hidden");
        ordersList.innerHTML = "";

        const result = await AUTH.getMyOrders();

        ordersLoading.classList.add("hidden");

        if (result && result.success && Array.isArray(result.orders)) {
          allOrders = result.orders;
          updateCounts();
          renderOrders();

          // If arriving from checkout with orderId, automatically expand and highlight that order
          if (targetOrderId) {
            const found = allOrders.find(o => (o.id === targetOrderId || o.orderId === targetOrderId));
            if (found) {
              setTimeout(() => {
                const card = document.getElementById(`order-card-${found.id}`);
                if (card) {
                  card.scrollIntoView({ behavior: "smooth", block: "start" });
                  // Automatically open the tracking panel
                  const trackPanel = document.getElementById(`tracking-panel-${found.id}`);
                  if (trackPanel && trackPanel.classList.contains("hidden")) {
                    trackPanel.classList.remove("hidden");
                  }
                }
              }, 150);
            }
          }
        } else {
          ordersEmpty.classList.remove("hidden");
          document.getElementById("empty-title").textContent = "Unable to load orders";
          document.getElementById("empty-text").textContent = result.error || "Please verify your network connection and try again.";
        }
      }

      // 3. Update Filter Tab Badges
      function updateCounts() {
        const total = allOrders.length;
        const active = allOrders.filter(o => isOrderActive(o)).length;
        const delivered = allOrders.filter(o => (o.status || "").toLowerCase() === "delivered").length;
        const cancelled = allOrders.filter(o => (o.status || "").toLowerCase() === "cancelled").length;

        document.getElementById("count-all").textContent = total;
        document.getElementById("count-active").textContent = active;
        document.getElementById("count-delivered").textContent = delivered;
        document.getElementById("count-cancelled").textContent = cancelled;
      }

      function isOrderActive(order) {
        const s = (order.status || "").toLowerCase();
        return ["order placed", "order confirmed", "processing", "shipped", "out for delivery", "confirmed", "paid", "pending"].includes(s);
      }

      // 4. Render Orders List
      function renderOrders() {
        let filtered = allOrders;

        // Apply Tab Filter
        if (currentFilter === "active") {
          filtered = filtered.filter(isOrderActive);
        } else if (currentFilter === "delivered") {
          filtered = filtered.filter(o => (o.status || "").toLowerCase() === "delivered");
        } else if (currentFilter === "cancelled") {
          filtered = filtered.filter(o => (o.status || "").toLowerCase() === "cancelled");
        }

        // Apply Search Filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(o => {
            const orderIdMatch = (o.id || "").toLowerCase().includes(q);
            const itemMatch = Array.isArray(o.items) && o.items.some(i => (i.name || "").toLowerCase().includes(q));
            return orderIdMatch || itemMatch;
          });
        }

        if (filtered.length === 0) {
          ordersEmpty.classList.remove("hidden");
          if (allOrders.length === 0) {
            document.getElementById("empty-title").textContent = "No Orders Placed Yet";
            document.getElementById("empty-text").textContent = "You haven't placed any orders with Krisin Clothing yet. Explore our curated collections and discover your new look.";
            document.getElementById("empty-btn").textContent = "Explore Collections";
            document.getElementById("empty-btn").href = "shop.html";
          } else {
            document.getElementById("empty-title").textContent = "No Orders Match";
            document.getElementById("empty-text").textContent = "No orders found matching your selected filter or search term.";
            document.getElementById("empty-btn").textContent = "View All Orders";
            document.getElementById("empty-btn").href = "#";
            document.getElementById("empty-btn").onclick = (e) => {
              e.preventDefault();
              setFilter("all");
            };
          }
          ordersList.innerHTML = "";
          return;
        }

        ordersEmpty.classList.add("hidden");
        ordersList.innerHTML = filtered.map(order => createOrderCardHTML(order)).join("");
      }

      function getBadgeClass(status) {
        const s = (status || "").toLowerCase();
        if (s === "order placed") return "badge-placed";
        if (s === "order confirmed" || s === "confirmed" || s === "paid") return "badge-confirmed";
        if (s === "processing") return "badge-processing";
        if (s === "shipped") return "badge-shipped";
        if (s === "out for delivery") return "badge-out-for-delivery";
        if (s === "delivered") return "badge-delivered";
        if (s === "cancelled") return "badge-cancelled";
        return "badge-placed";
      }

      function isCancellable(status) {
        const s = (status || "").toLowerCase();
        return ["order placed", "order confirmed", "processing", "pending", "confirmed"].includes(s);
      }

      // Generate HTML for Single Order Card
      function createOrderCardHTML(order) {
        const items = Array.isArray(order.items) ? order.items : [];
        const badgeClass = getBadgeClass(order.status);
        const orderDateFormatted = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }) : "Recently";

        const cancellable = isCancellable(order.status);

        return `
          <div class="order-card" id="order-card-${order.id}">
            <!-- Header -->
            <div class="order-card-header">
              <div class="order-header-left">
                <span class="order-id-label">#${escapeHtml(order.id)}</span>
                <div class="order-header-meta">
                  <span>Placed on <strong>${orderDateFormatted}</strong></span>
                  <span>•</span>
                  <span>Total <strong>${formatPrice(order.totalAmount || order.total || 0)}</strong></span>
                </div>
              </div>
              <span class="order-status-badge ${badgeClass}">${escapeHtml(order.status || "Order Confirmed")}</span>
            </div>

            <!-- Body: Items Preview -->
            <div class="order-card-body">
              ${items.map(item => createItemRowHTML(item)).join("")}
            </div>

            <!-- Footer: Summary & Actions -->
            <div class="order-card-footer">
              <div class="order-info-pills">
                <div class="order-info-pill">
                  <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <span>Payment: <strong>${escapeHtml(order.paymentMethod || "Online")} (${escapeHtml(order.paymentStatus || "Paid")})</strong></span>
                </div>
                ${order.estimatedDelivery && order.status !== "Cancelled" && order.status !== "Delivered" ? `
                  <div class="order-info-pill">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>Est. Delivery: <strong>${escapeHtml(order.estimatedDelivery)}</strong></span>
                  </div>
                ` : ""}
              </div>

              <div class="order-actions-wrap">
                <button type="button" class="btn-sm-order btn-order-track" data-track-toggle="${order.id}">
                  <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;"><polyline points="20 6 9 17 4 12"/></svg>
                  Track Shipment
                </button>
                <button type="button" class="btn-sm-order btn-order-details" data-view-details="${order.id}">
                  View Details
                </button>
                ${cancellable ? `
                  <button type="button" class="btn-sm-order btn-order-cancel" data-cancel-order="${order.id}">
                    Cancel Order
                  </button>
                ` : ""}
              </div>
            </div>

            <!-- Expandable Tracking Timeline -->
            <div class="order-tracking-panel hidden" id="tracking-panel-${order.id}">
              <div class="tracking-header">
                <div class="tracking-title">
                  <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent);fill:none;stroke-width:2;"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  Fulfillment &amp; Delivery Progress
                </div>
                ${order.status !== "Cancelled" && order.estimatedDelivery ? `
                  <div class="tracking-est-date">
                    Expected Arrival: <strong>${escapeHtml(order.estimatedDelivery)}</strong>
                  </div>
                ` : ""}
              </div>

              ${createTrackerHTML(order)}
            </div>
          </div>
        `;
      }

      function createItemRowHTML(item) {
        const itemImg = item.image || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop";
        const unitPrice = parseFloat(item.price) || 0;
        const qty = parseInt(item.qty, 10) || 1;
        const total = unitPrice * qty;

        return `
          <div class="order-item-row">
            <div class="order-item-thumb">
              <img src="${itemImg}" alt="${escapeHtml(item.name || 'Clothing item')}">
            </div>
            <div class="order-item-details">
              <div class="order-item-name">${escapeHtml(item.name || 'Product')}</div>
              <div class="order-item-variants">
                ${item.size ? `<span>Size: <strong>${escapeHtml(item.size)}</strong></span>` : ""}
                ${item.color ? `<span>Color: <strong>${escapeHtml(item.color)}</strong></span>` : ""}
                <span>Qty: <strong>${qty}</strong></span>
              </div>
            </div>
            <div class="order-item-price-col">
              <div class="order-item-price">${formatPrice(total)}</div>
              ${qty > 1 ? `<div class="order-item-qty">${formatPrice(unitPrice)} each</div>` : ""}
            </div>
          </div>
        `;
      }

      // Generate Visual Progress Tracker & Timeline
      function createTrackerHTML(order) {
        const currentStatus = (order.status || "Order Confirmed").trim();
        const isCancelled = currentStatus.toLowerCase() === "cancelled";

        if (isCancelled) {
          const cancelTimeFormatted = order.cancelledAt ? new Date(order.cancelledAt).toLocaleString("en-IN", {
            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
          }) : "Recent";
          return `
            <div class="tracker-cancelled-box">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <div>
                <div class="tracker-cancelled-title">This order has been cancelled</div>
                <div class="tracker-cancelled-desc">
                  Cancelled on ${cancelTimeFormatted}.<br>
                  Order status: <em>Cancelled</em>.<br>
                  ${order.paymentStatus === "Refund Initiated" ? `<strong style="color:#065f46">Refund of ${formatPrice(order.totalAmount || order.total || 0)} has been initiated to your original payment method.</strong>` : ""}
                </div>
              </div>
            </div>
            ${createEventsListHTML(order.timeline || [])}
          `;
        }

        // Determine current stage index (0 to 5)
        let currentIndex = 0;
        const norm = currentStatus.toLowerCase();
        if (norm === "order placed") currentIndex = 0;
        else if (norm === "order confirmed" || norm === "confirmed" || norm === "paid") currentIndex = 1;
        else if (norm === "processing") currentIndex = 2;
        else if (norm === "shipped") currentIndex = 3;
        else if (norm === "out for delivery") currentIndex = 4;
        else if (norm === "delivered") currentIndex = 5;

        const percent = Math.min(100, Math.round((currentIndex / (STAGES.length - 1)) * 100));

        const stepsHTML = STAGES.map((stage, idx) => {
          let stateClass = "";
          let iconHTML = `<span>${idx + 1}</span>`;

          if (idx < currentIndex) {
            stateClass = "completed";
            iconHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
          } else if (idx === currentIndex) {
            stateClass = "current";
            iconHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>`;
          }

          // Look up timestamp for this stage in timeline events if available
          const eventMatch = (order.timeline || []).find(e => (e.stage || "").toLowerCase() === stage.toLowerCase());
          const dateStr = eventMatch && eventMatch.time ? new Date(eventMatch.time).toLocaleDateString("en-IN", {
            day: "numeric", month: "short"
          }) : "";

          return `
            <div class="tracker-step ${stateClass}">
              <div class="tracker-node">${iconHTML}</div>
              <div class="tracker-label">${escapeHtml(stage)}</div>
              ${dateStr ? `<div class="tracker-date">${dateStr}</div>` : ""}
            </div>
          `;
        }).join("");

        return `
          <div class="tracker-progress-bar">
            <div class="tracker-connector">
              <div class="tracker-connector-fill" style="width: ${percent}%;"></div>
            </div>
            ${stepsHTML}
          </div>
          ${createEventsListHTML(order.timeline || [])}
        `;
      }

      // Generate Chronological Event History List
      function createEventsListHTML(timeline) {
        if (!Array.isArray(timeline) || timeline.length === 0) return "";

        return `
          <div class="tracking-events-list">
            <div class="tracking-events-title">Shipment Updates &amp; Event History</div>
            ${timeline.slice().reverse().map(event => {
              const dateFormatted = event.time ? new Date(event.time).toLocaleString("en-IN", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
              }) : "";
              const isCancelledEvent = (event.stage || "").toLowerCase() === "cancelled";

              return `
                <div class="tracking-event-item ${isCancelledEvent ? 'is-cancelled' : ''}">
                  <div class="tracking-event-bullet"></div>
                  <div class="tracking-event-content">
                    <div class="tracking-event-title-wrap">
                      <div class="tracking-event-title">${escapeHtml(event.stage || "Update")}</div>
                      <div class="tracking-event-time">${dateFormatted}</div>
                    </div>
                    <div class="tracking-event-note">${escapeHtml(event.note || "")}</div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `;
      }

      // 5. Open Order Details Modal
      function openDetailsModal(order) {
        if (!order) return;

        document.getElementById("modal-order-title").textContent = `Order #${order.id}`;
        const orderDateFormatted = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        }) : "";
        document.getElementById("modal-order-meta").textContent = `Placed on ${orderDateFormatted} • Status: ${order.status}`;

        // Tracker in modal
        document.getElementById("modal-tracker-content").innerHTML = createTrackerHTML(order);

        // Items
        const items = Array.isArray(order.items) ? order.items : [];
        document.getElementById("modal-items-content").innerHTML = items.map(item => createItemRowHTML(item)).join("");

        // Shipping Address
        const addr = order.shippingAddress || {};
        document.getElementById("modal-address-content").innerHTML = `
          <div class="orders-modal-grid">
            <div>
              <div style="font-weight:600;color:var(--black);margin-bottom:2px;">${escapeHtml(order.customerName || "Customer")}</div>
              <div>${escapeHtml(addr.address || "No street address provided")}</div>
              <div>${escapeHtml([addr.city, addr.state, addr.pincode].filter(Boolean).join(", "))}</div>
              ${order.customerPhone ? `<div style="margin-top:4px;color:var(--stone);">Phone: ${escapeHtml(order.customerPhone)}</div>` : ""}
            </div>
            <div>
              <div style="font-size:12px;color:var(--stone);text-transform:uppercase;font-weight:600;">Contact Email</div>
              <div style="font-weight:500;margin-top:2px;">${escapeHtml(order.customerEmail || "—")}</div>
            </div>
          </div>
        `;

        // Payment & Totals Breakdown
        document.getElementById("modal-payment-content").innerHTML = `
          <div style="background:#f7f6f2;border:1px solid var(--line);border-radius:6px;padding:14px 18px;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13.5px;">
              <span style="color:var(--stone)">Items Subtotal</span>
              <span style="font-weight:600;">${formatPrice(order.subtotal || 0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13.5px;">
              <span style="color:var(--stone)">Shipping Fee</span>
              <span style="font-weight:600;">${(order.shippingFee === 0) ? "FREE" : formatPrice(order.shippingFee || 0)}</span>
            </div>
            ${order.codFee ? `
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13.5px;">
                <span style="color:var(--stone)">COD Handling Fee</span>
                <span style="font-weight:600;">${formatPrice(order.codFee)}</span>
              </div>
            ` : ""}
            <div style="display:flex;justify-content:space-between;padding:10px 0 4px;margin-top:8px;border-top:1px solid var(--line);font-size:16px;">
              <span style="font-weight:700;color:var(--black);">Grand Total</span>
              <span style="font-weight:700;color:var(--black);">${formatPrice(order.totalAmount || order.total || 0)}</span>
            </div>
            <div style="font-size:12px;color:var(--stone);margin-top:8px;">
              Paid with <strong>${escapeHtml(order.paymentMethod || "Online")}</strong> • Status: <strong>${escapeHtml(order.paymentStatus || "Paid")}</strong>
              ${order.paymentId ? `<br>Reference ID: <code style="background:#e9e6e0;padding:2px 4px;border-radius:3px;">${escapeHtml(order.paymentId)}</code>` : ""}
            </div>
          </div>
        `;

        // Cancel button in modal
        const cancelBtn = document.getElementById("modal-cancel-btn");
        if (isCancellable(order.status)) {
          cancelBtn.classList.remove("hidden");
          cancelBtn.onclick = () => {
            closeDetailsModal();
            promptCancelOrder(order.id);
          };
        } else {
          cancelBtn.classList.add("hidden");
        }

        detailsModal.classList.add("open");
      }

      function closeDetailsModal() {
        detailsModal.classList.remove("open");
      }

      // 6. Cancellation Flow
      function promptCancelOrder(orderId) {
        activeCancelOrderId = orderId;
        document.getElementById("cancel-order-id-display").textContent = "#" + orderId;
        cancelModal.classList.add("open");
      }

      function closeCancelModal() {
        cancelModal.classList.remove("open");
        activeCancelOrderId = null;
      }

      async function executeCancellation() {
        if (!activeCancelOrderId) return;
        const confirmBtn = document.getElementById("cancel-confirm-btn");
        const reasonSelect = document.getElementById("cancel-reason-select");
        const reason = reasonSelect.value;

        confirmBtn.disabled = true;
        confirmBtn.textContent = "Cancelling…";

        const res = await AUTH.cancelOrder(activeCancelOrderId, reason);

        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Cancellation";

        if (res && res.success) {
          showToast(`Order #${activeCancelOrderId} cancelled successfully.`);
          closeCancelModal();
          // Reload orders to reflect updated status and timeline
          await loadOrders();
        } else {
          alert(res.error || "Unable to cancel this order. Please try again or contact support.");
        }
      }

      // 7. Event Delegations
      ordersList.addEventListener("click", (e) => {
        // Toggle tracking timeline
        const trackToggle = e.target.closest("[data-track-toggle]");
        if (trackToggle) {
          const orderId = trackToggle.dataset.trackToggle;
          const panel = document.getElementById(`tracking-panel-${orderId}`);
          if (panel) {
            panel.classList.toggle("hidden");
            if (!panel.classList.contains("hidden")) {
              panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }
          return;
        }

        // View Details
        const viewBtn = e.target.closest("[data-view-details]");
        if (viewBtn) {
          const orderId = viewBtn.dataset.viewDetails;
          const order = allOrders.find(o => o.id === orderId);
          if (order) openDetailsModal(order);
          return;
        }

        // Cancel Order Button
        const cancelBtn = e.target.closest("[data-cancel-order]");
        if (cancelBtn) {
          const orderId = cancelBtn.dataset.cancelOrder;
          promptCancelOrder(orderId);
          return;
        }
      });

      // Filter Tabs
      function setFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll(".order-tab-btn").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.filter === filter);
        });
        renderOrders();
      }

      filterTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".order-tab-btn");
        if (btn) setFilter(btn.dataset.filter);
      });

      // Search Box
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim();
        renderOrders();
      });

      // Modal Closers
      document.getElementById("modal-close-btn").addEventListener("click", closeDetailsModal);
      document.getElementById("modal-dismiss-btn").addEventListener("click", closeDetailsModal);
      detailsModal.addEventListener("click", (e) => {
        if (e.target === detailsModal) closeDetailsModal();
      });

      document.getElementById("cancel-modal-close-btn").addEventListener("click", closeCancelModal);
      document.getElementById("cancel-abort-btn").addEventListener("click", closeCancelModal);
      cancelModal.addEventListener("click", (e) => {
        if (e.target === cancelModal) closeCancelModal();
      });

      document.getElementById("cancel-confirm-btn").addEventListener("click", executeCancellation);

      // Helper
      function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
      }

      // Initial Load
      loadOrders();
    })();
  