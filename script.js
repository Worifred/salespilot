const SUPABASE_URL = "https://vqmuycanfvbedlcevhsk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_D5dTxH10R5C2YJBiQ6PqJA_eO515r9_";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
const customerForm = document.getElementById("customerForm");
const customerFormSection = document.getElementById("customerFormSection");
const customerList = document.getElementById("customerList");
const searchCustomers = document.getElementById("searchCustomers");

let customers = [];
let currentFilter = "all";

try {
  customers = JSON.parse(localStorage.getItem("salesPilotCustomers") || "[]");
  if (!Array.isArray(customers)) customers = [];
} catch {
  customers = [];
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function saveCustomers() {
  localStorage.setItem("salesPilotCustomers", JSON.stringify(customers));
  renderCustomers();
}

function showCustomerForm() {
  customerFormSection.hidden = false;
  document.getElementById("customerName").focus();
  customerFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("addCustomerBtn").addEventListener("click", showCustomerForm);

document.getElementById("cancelFormBtn").addEventListener("click", () => {
  customerForm.reset();
  customerFormSection.hidden = true;
});

customerForm.addEventListener("submit", event => {
  event.preventDefault();

  const form = new FormData(customerForm);
  const customer = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2),
    name: String(form.get("customerName") || "").trim(),
    phone: String(form.get("customerPhone") || "").trim(),
    product: String(form.get("product") || "").trim(),
    budget: String(form.get("budget") || "").trim(),
    lastContact: String(form.get("lastContact") || ""),
    followupDate: String(form.get("followupDate") || ""),
    notes: String(form.get("customerNotes") || "").trim(),
    status: "open",
    createdAt: new Date().toISOString()
  };

  if (!customer.name || !customer.phone || !customer.product || !customer.followupDate) {
    alert("Please fill in all required fields.");
    return;
  }

  customers.unshift(customer);
  saveCustomers();
  customerForm.reset();
  customerFormSection.hidden = true;
  alert("Customer saved successfully!");
});

function getFollowupStatus(customer) {
  if (customer.status === "sold") return "Sold";

  const today = localDateString();

  if (customer.followupDate < today) return "Overdue";
  if (customer.followupDate === today) return "Due today";
  return "Upcoming";
}

function createFollowupMessage(customer) {
  return `Hello ${customer.name}, I hope you're doing well! I'm just following up on your enquiry about ${customer.product}. Please let me know if you have any questions or if you'd like an update. No pressure at all. Thank you!`;
}

function openWhatsApp(customer) {
  let phone = customer.phone.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "234" + phone.slice(1);
  } else if (phone.startsWith("234")) {
    // Already using Nigeria's country code.
  } else if (phone.startsWith("0") === false && phone.length === 10) {
    phone = "234" + phone;
  }

  const message = createFollowupMessage(customer);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

function renderCustomers() {
  const today = localDateString();
  const openCustomers = customers.filter(customer => customer.status !== "sold");
  const dueCustomers = openCustomers.filter(customer => customer.followupDate <= today);

  document.getElementById("totalCustomers").textContent = customers.length;
  document.getElementById("todayFollowups").textContent = dueCustomers.length;
  document.getElementById("openCustomers").textContent = openCustomers.length;
  document.getElementById("customerCount").textContent =
    `${customers.length} saved`;

  const query = searchCustomers.value.trim().toLowerCase();

  const filtered = customers.filter(customer => {
    const matchesSearch =
      customer.name.toLowerCase().includes(query) ||
      customer.product.toLowerCase().includes(query) ||
      customer.phone.includes(query);

    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "sold" && customer.status === "sold") ||
      (currentFilter === "due" &&
        customer.status !== "sold" &&
        customer.followupDate <= today) ||
      (currentFilter === "upcoming" &&
        customer.status !== "sold" &&
        customer.followupDate > today);

    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    customerList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♡</div>
        <h3>${customers.length ? "No matching customers" : "Your customer list starts here"}</h3>
        <p>${customers.length
          ? "Try another search or filter."
          : "Add a customer who has shown interest but hasn't bought yet."}</p>
      </div>`;
    return;
  }

  customerList.innerHTML = filtered.map(customer => {
    const status = getFollowupStatus(customer);
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");

    return `
      <article class="customer-card">
        <div class="customer-card-top">
          <div>
            <h3>${escapeHTML(customer.name)}</h3>
            <p class="customer-product">${escapeHTML(customer.product)}</p>
          </div>
          <span class="customer-status ${statusClass}">${status}</span>
        </div>

        <div class="customer-details">
          <p><strong>Phone:</strong> ${escapeHTML(customer.phone)}</p>
          <p><strong>Budget:</strong> ${
            customer.budget
              ? "₦" + Number(customer.budget).toLocaleString("en-NG")
              : "Not specified"
          }</p>
          <p><strong>Follow up:</strong> ${escapeHTML(customer.followupDate)}</p>
          ${customer.notes
            ? `<p><strong>Notes:</strong> ${escapeHTML(customer.notes)}</p>`
            : ""}
        </div>

        <div class="customer-actions">
          <button type="button" class="small-btn whatsapp-btn" data-action="whatsapp" data-id="${escapeHTML(customer.id)}">WhatsApp message</button>
          ${customer.status !== "sold"
            ? `<button type="button" class="small-btn sold-btn" data-action="sold" data-id="${escapeHTML(customer.id)}">Mark as sold</button>`
            : ""}
          <button type="button" class="small-btn delete-btn" data-action="delete" data-id="${escapeHTML(customer.id)}">Delete</button>
        </div>
      </article>`;
  }).join("");
}

searchCustomers.addEventListener("input", renderCustomers);

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".filter-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderCustomers();
  });
});

customerList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const customer = customers.find(item => item.id === button.dataset.id);
  if (!customer) return;

  if (button.dataset.action === "whatsapp") {
    openWhatsApp(customer);
  }

  if (button.dataset.action === "sold") {
    if (confirm(`Mark ${customer.name} as a completed sale?`)) {
      customer.status = "sold";
      saveCustomers();
    }
  }

  if (button.dataset.action === "delete") {
    if (confirm(`Delete ${customer.name} from your customer list?`)) {
      customers = customers.filter(item => item.id !== customer.id);
      saveCustomers();
    }
  }
});

renderCustomers();
