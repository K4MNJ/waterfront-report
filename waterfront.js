(function () {
  if (!/(^|\.)harbourridge\.com$/.test(location.hostname)) {
    alert(
      "Waterfront Trips Report: this bookmark must be clicked while you're on a harbourridge.com tab " +
      "(you're currently on \"" + location.origin + "\"). Go to harbourridge.com, make sure you're logged in, " +
      "then click this bookmark again."
    );
    return;
  }
  if (window.__hrTripsPanel) {
    document.body.removeChild(window.__hrTripsPanel);
    window.__hrTripsPanel = null;
  }
  var CLUB_ID = 1039;
  var WATERFRONT_GROUP_CODE = "W";

  function fmtDate(d) {
    return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  }
  function fmtDay(d) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  function fmtTime(d) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function toYMD(d) {
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getDateRange(key) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (key === "thisWeek" || key === "nextWeek") {
      var sunday = new Date(today);
      sunday.setDate(today.getDate() - today.getDay());
      if (key === "nextWeek") sunday.setDate(sunday.getDate() + 7);
      var saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      return { start: sunday, end: saturday, label: key === "thisWeek" ? "this week" : "next week" };
    }
    var year = today.getFullYear(), month = today.getMonth();
    if (key === "nextMonth") month += 1;
    var first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
    return { start: first, end: last, label: key === "thisMonth" ? "this month" : "next month" };
  }

  // The calendar item's event id (CID) -- prefer a CID= in any URL field, then common id field names.
  function getCid(item) {
    for (var k in item) {
      if (typeof item[k] === "string") {
        var m = item[k].match(/[?&]CID=(\d+)/i);
        if (m) return m[1];
      }
    }
    var keys = ["calendarItemId", "calendarId", "cid", "CID", "eventId", "itemId", "id"];
    for (var i = 0; i < keys.length; i++) {
      if (item[keys[i]] != null && item[keys[i]] !== "") return item[keys[i]];
    }
    return null;
  }

  // Phones and other narrow screens get a full-width panel with one card per trip instead of the table.
  var NARROW = window.innerWidth < 640;

  // Phone number as a tap-to-call link.
  function telLink(phone) {
    var digits = phone.replace(/[^\d+]/g, "");
    return '<a href="tel:' + esc(digits) + '" style="color:#307D7E;text-decoration:none;font-weight:600;white-space:nowrap;">' + esc(phone) + "</a>";
  }

  var panel = document.createElement("div");
  panel.id = "hrTripsPanel";
  panel.style.cssText =
    (NARROW
      ? "position:fixed;top:8px;left:8px;right:8px;max-height:calc(100vh - 16px);overflow:auto;font-size:16px;padding:12px;"
      : "position:fixed;top:20px;right:20px;width:720px;max-width:92vw;max-height:85vh;overflow:auto;padding:16px;") +
    "background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:left;line-height:1.35;" +
    "z-index:2147483647;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;";
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
    '<strong style="font-size:1.05rem;">Waterfront Trips Report</strong>' +
    '<button id="hrTripsClose" aria-label="Close" style="border:none;background:none;font-size:1.1rem;cursor:pointer;color:#1a1a1a;' +
    (NARROW ? "padding:8px 12px;margin:-8px -8px -8px 0;" : "") + '">✕</button>' +
    "</div>" +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
    '<label for="hrTripsRange" style="font-size:.85rem;">Range:</label>' +
    '<select id="hrTripsRange" style="font-size:.85rem;padding:' + (NARROW ? "8px" : "5px 8px") + ';">' +
    '<option value="thisWeek">This week</option>' +
    '<option value="nextWeek">Next week</option>' +
    '<option value="thisMonth" selected>This month</option>' +
    '<option value="nextMonth">Next month</option>' +
    "</select>" +
    '<button id="hrTripsRefresh" style="font-size:.85rem;padding:' + (NARROW ? "8px 14px" : "5px 10px") + ';background:#307D7E;color:#fff;border:none;border-radius:4px;cursor:pointer;">Refresh</button>' +
    "</div>" +
    '<div id="hrTripsStatus" style="font-size:.85rem;margin-bottom:8px;color:#666;">Loading…</div>' +
    '<table id="hrTripsTable" style="width:100%;border-collapse:collapse;display:none;">' +
    "<thead><tr>" +
    '<th style="text-align:left;padding:6px;background:#307D7E;color:#fff;">Date</th>' +
    '<th style="text-align:left;padding:6px;background:#307D7E;color:#fff;">Day</th>' +
    '<th style="text-align:left;padding:6px;background:#307D7E;color:#fff;">Departs</th>' +
    '<th style="text-align:left;padding:6px;background:#307D7E;color:#fff;">Location</th>' +
    '<th style="text-align:left;padding:6px;background:#307D7E;color:#fff;">Headcount</th>' +
    '<th style="text-align:left;padding:6px;background:#307D7E;color:#fff;"></th>' +
    "</tr></thead>" +
    '<tbody id="hrTripsBody"></tbody>' +
    "</table>" +
    '<div id="hrTripsCards"></div>';
  document.body.appendChild(panel);
  window.__hrTripsPanel = panel;

  document.getElementById("hrTripsClose").addEventListener("click", function () {
    document.body.removeChild(panel);
    window.__hrTripsPanel = null;
  });

  // The registrants API needs the site's authTokens/http helpers. They exist on event pages; on any
  // other harbourridge.com page, load an event page in a hidden iframe and borrow them from there.
  var apiPromise = null;
  function getApi(cid) {
    if (window.authTokens && window.http) return Promise.resolve(window);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      var frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = "/club/scripts/calendar/View_Club_CalendarItem.asp?CID=" + encodeURIComponent(cid) + "&NS=MYLOCKER";
      frame.addEventListener("load", function () {
        var tries = 0;
        var timer = setInterval(function () {
          var w = frame.contentWindow;
          if (w && w.authTokens && w.http) {
            clearInterval(timer);
            resolve(w);
          } else if (++tries > 40) {
            clearInterval(timer);
            reject(new Error("couldn't load harbourridge.com's sign-in helpers (are you logged in?)"));
          }
        }, 250);
      });
      panel.appendChild(frame);
    });
    apiPromise.catch(function () { apiPromise = null; });
    return apiPromise;
  }

  function loadRegistrants(cid) {
    return getApi(cid).then(function (w) {
      return w.authTokens.getMemberAuthTokenAsync().then(function (token) {
        return w.http.getAsync("/api/v1/EventRegistration/" + cid + "/registrants?includeWaitlist=true", token);
      });
    });
  }

  // Registrant rows carry no phone numbers, but each member's userId is their directory profile's UID.
  // Read the Mobile/Cell number from that profile. Requests are queued one at a time and cached per user.
  var phoneCache = {};
  var phoneQueue = Promise.resolve();
  function lookupPhone(userId) {
    if (phoneCache[userId]) return phoneCache[userId];
    phoneCache[userId] = phoneQueue = phoneQueue.then(function () {
      return fetch("/club/scripts/member/member_profile.asp?NS=MYLOCKER&UID=" + encodeURIComponent(userId), { credentials: "include" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var text = doc.body ? doc.body.textContent.replace(/\s+/g, " ") : "";
          var m = text.match(/(?:Mobile|Cell)(?: Phone)?\s*:\s*(\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})/i) ||
            text.match(/(?:Home )?Phone\s*:\s*(\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})/i);
          return m ? m[1].trim() : "";
        })
        .catch(function () { return ""; });
    });
    return phoneCache[userId];
  }

  function renderMembers(cell, resp) {
    var regs = (resp.registrants || []).filter(function (r) { return !r.isOnWaitlist; });
    if (regs.length === 0) {
      cell.innerHTML = '<div style="font-size:.85rem;color:#666;">No one is registered for this trip yet.</div>';
      return;
    }
    var regId = function (r) { return r.registrationId != null ? r.registrationId : r.id; };
    // Title (Mr., Mrs., Dr., ...) from the registration, when there is one.
    var fullName = function (r) {
      return [r.userTitle, r.firstName, r.lastName].map(function (s) { return (s || "").trim(); }).filter(Boolean).join(" ");
    };
    var bookers = regs.filter(function (r) { return r.registrantType === "B" && r.linkedRegistrationId == null; });
    var ordered = [];
    bookers.forEach(function (b) {
      ordered.push({ r: b, booker: true });
      regs.forEach(function (r) {
        if (r !== b && r.linkedRegistrationId != null && r.linkedRegistrationId === regId(b)) ordered.push({ r: r, booker: false });
      });
    });
    regs.forEach(function (r) {
      if (!ordered.some(function (o) { return o.r === r; })) ordered.push({ r: r, booker: false });
    });

    var pending = '<span style="color:#999;">looking up…</span>';
    var html;
    if (NARROW) {
      html = '<div style="background:#f7fafa;border-radius:6px;">';
      ordered.forEach(function (o, idx) {
        var name = fullName(o.r);
        html +=
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;' +
          "padding:8px 10px" + (o.booker ? "" : " 8px 26px") + ";border-top:" + (idx === 0 ? "none" : "1px solid #e6eded") + ';font-size:.95rem;">' +
          "<span>" + (o.booker
            ? "<strong>" + esc(name) + '</strong> <span style="color:#666;font-size:.85rem;">· party of ' + esc(o.r.headCount) + "</span>"
            : esc(name)) + "</span>" +
          '<span data-phone="' + idx + '" style="font-size:.95rem;margin-left:auto;">' + (o.r.userId ? pending : '<span style="color:#999;">—</span>') + "</span>" +
          "</div>";
      });
      html += "</div>";
    } else {
      var td = 'style="padding:4px 6px;border-bottom:1px solid #eee;font-size:.85rem;"';
      html =
        '<table style="width:100%;border-collapse:collapse;background:#f7fafa;">' +
        '<thead><tr><th style="text-align:left;padding:4px 6px;font-size:.8rem;color:#555;">Name</th>' +
        '<th style="text-align:left;padding:4px 6px;font-size:.8rem;color:#555;">Party</th>' +
        '<th style="text-align:left;padding:4px 6px;font-size:.8rem;color:#555;">Phone</th></tr></thead><tbody>';
      ordered.forEach(function (o, idx) {
        var name = fullName(o.r);
        html +=
          "<tr>" +
          "<td " + td + ">" + (o.booker ? "<strong>" + esc(name) + "</strong>" : '<span style="color:#888;">↳</span> ' + esc(name)) + "</td>" +
          "<td " + td + ">" + (o.booker ? esc(o.r.headCount) : "") + "</td>" +
          "<td " + td + ' data-phone="' + idx + '">' + (o.r.userId ? pending : "—") + "</td>" +
          "</tr>";
      });
      html += "</tbody></table>";
    }
    html +=
      '<div style="font-size:.8rem;color:#666;margin-top:4px;">' + bookers.length + " part" + (bookers.length === 1 ? "y" : "ies") +
      ", " + (resp.totalHeadCount != null ? resp.totalHeadCount : "?") + " people (waitlist excluded)</div>";
    cell.innerHTML = html;

    ordered.forEach(function (o, idx) {
      if (!o.r.userId) return;
      var phoneCell = cell.querySelector('[data-phone="' + idx + '"]');
      lookupPhone(o.r.userId).then(function (phone) {
        phoneCell.innerHTML = phone ? telLink(phone) : '<span style="color:#999;">—</span>';
      });
    });
  }

  // Shows/hides a trip's member list. `trip.attach(detailEl)` puts a new list container in place and
  // returns the element to render into; the container is kept on `trip.detail` for later toggles.
  function toggleMembers(btn, trip, item) {
    if (trip.detail && trip.detail.getAttribute("data-failed")) {
      trip.detail.parentNode.removeChild(trip.detail);
      trip.detail = null;
    }
    if (trip.detail) {
      var hidden = trip.detail.style.display === "none";
      trip.detail.style.display = hidden ? "" : "none";
      btn.textContent = hidden ? "Hide" : "Members";
      return;
    }
    var cell = trip.attach();
    var detail = trip.detail;
    cell.innerHTML = '<div style="font-size:.85rem;color:#666;">Loading members…</div>';
    btn.textContent = "Hide";

    var cid = getCid(item);
    if (!cid) {
      cell.innerHTML = '<div style="font-size:.85rem;color:#b3261e;">Couldn\'t find this trip\'s event id. Calendar fields: ' +
        esc(Object.keys(item).join(", ")) + "</div>";
      return;
    }
    loadRegistrants(cid)
      .then(function (resp) { renderMembers(cell, resp || {}); })
      .catch(function (err) {
        cell.innerHTML = '<div style="font-size:.85rem;color:#b3261e;">Failed to load members: ' + esc(err && err.message ? err.message : err) + "</div>";
        detail.setAttribute("data-failed", "1");
        btn.textContent = "Retry";
      });
  }

  function addTableRow(body, item, start) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td style="padding:6px;border-bottom:1px solid #eee;">' + fmtDate(start) + "</td>" +
      '<td style="padding:6px;border-bottom:1px solid #eee;">' + fmtDay(start) + "</td>" +
      '<td style="padding:6px;border-bottom:1px solid #eee;">' + fmtTime(start) + "</td>" +
      '<td style="padding:6px;border-bottom:1px solid #eee;">' + (item.locationDesc || "") + "</td>" +
      '<td style="padding:6px;border-bottom:1px solid #eee;font-weight:600;">' + (item.totalHeadCount != null ? item.totalHeadCount : "—") + "</td>" +
      '<td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">' +
      '<button type="button" style="font-size:.8rem;padding:3px 8px;background:#fff;color:#307D7E;border:1px solid #307D7E;border-radius:4px;cursor:pointer;">Members</button></td>';
    var trip = {
      detail: null,
      attach: function () {
        var row = document.createElement("tr");
        var cell = document.createElement("td");
        cell.colSpan = 6;
        cell.style.cssText = "padding:6px 6px 12px 18px;border-bottom:1px solid #ddd;";
        row.appendChild(cell);
        tr.parentNode.insertBefore(row, tr.nextSibling);
        trip.detail = row;
        return cell;
      }
    };
    var btn = tr.querySelector("button");
    btn.addEventListener("click", function () { toggleMembers(btn, trip, item); });
    body.appendChild(tr);
  }

  function addCard(cards, item, start) {
    var card = document.createElement("div");
    card.style.cssText = "border:1px solid #d7e3e3;border-left:4px solid #307D7E;border-radius:6px;padding:10px 12px;margin-bottom:10px;";
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">' +
      '<strong style="font-size:1rem;">' + esc(fmtDay(start)) + " " + esc(fmtDate(start)) + "</strong>" +
      '<span style="font-weight:600;white-space:nowrap;">' + esc(fmtTime(start)) + "</span></div>" +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;font-size:.9rem;color:#444;">' +
      "<span>" + esc(item.locationDesc || "") + " · <strong>" + (item.totalHeadCount != null ? esc(item.totalHeadCount) : "—") + "</strong> people</span>" +
      '<button type="button" style="font-size:.9rem;padding:8px 14px;background:#fff;color:#307D7E;border:1px solid #307D7E;border-radius:4px;cursor:pointer;">Members</button>' +
      "</div>";
    var trip = {
      detail: null,
      attach: function () {
        var wrap = document.createElement("div");
        wrap.style.cssText = "margin-top:10px;";
        card.appendChild(wrap);
        trip.detail = wrap;
        return wrap;
      }
    };
    var btn = card.querySelector("button");
    btn.addEventListener("click", function () { toggleMembers(btn, trip, item); });
    cards.appendChild(card);
  }

  function load() {
    var statusEl = document.getElementById("hrTripsStatus");
    var table = document.getElementById("hrTripsTable");
    var body = document.getElementById("hrTripsBody");
    var cards = document.getElementById("hrTripsCards");
    statusEl.style.color = "#666";
    statusEl.textContent = "Loading…";
    table.style.display = "none";
    body.innerHTML = "";
    cards.innerHTML = "";

    var rangeKey = document.getElementById("hrTripsRange").value;
    var r = getDateRange(rangeKey);
    var startDate = toYMD(r.start), endDate = toYMD(r.end);
    var url =
      "https://harbourridge.com/api/ClubData/web/GetClubCalendar?navSection=MYLOCKER&memFacId=0&memFacCode=" +
      "&startDate=" + startDate + "&endDate=" + endDate +
      "&category=&categoryCode=&categoryGroup=&categoryGroupCode=" +
      "&diningOverride=false&eventOverride=false&clubId=" + CLUB_ID +
      "&registrationGroupIds=&registrationGroupCatIds=&categoryIds=";

    fetch(url, { credentials: "include" })
      .then(function (res) {
        if (!res.ok) throw new Error("API returned HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = data.calendarItems || [];
        var trips = items
          .filter(function (i) { return i.categGroupCode === WATERFRONT_GROUP_CODE; })
          .sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
        if (rangeKey === "thisWeek" || rangeKey === "thisMonth") {
          var todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          trips = trips.filter(function (i) {
            var d = new Date(i.time);
            d.setHours(0, 0, 0, 0);
            return d >= todayStart;
          });
        }
        if (trips.length === 0) {
          statusEl.textContent = "No waterfront trips found for " + r.label + " (" + startDate + " to " + endDate + ").";
          return;
        }
        trips.forEach(function (item) {
          var start = new Date(item.time);
          if (NARROW) addCard(cards, item, start);
          else addTableRow(body, item, start);
        });
        if (!NARROW) table.style.display = "";
        statusEl.style.color = "#666";
        statusEl.textContent = "Loaded " + trips.length + " trip(s) for " + r.label + " (" + startDate + " to " + endDate + ").";
      })
      .catch(function (err) {
        statusEl.style.color = "#b3261e";
        statusEl.textContent = "Failed to load: " + err.message;
      });
  }

  document.getElementById("hrTripsRefresh").addEventListener("click", load);
  document.getElementById("hrTripsRange").addEventListener("change", load);
  load();
})();
