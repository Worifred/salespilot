const SUPABASE_URL = "https://vqmuycanfvbedlcevhsk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_D5dTxH10R5C2YJBiQ6PqJA_eO515r9_";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const authSection = document.getElementById("authSection");
const authForm = document.getElementById("authForm");
const authHeading = document.getElementById("authHeading");
const authSubmit = document.getElementById("authSubmit");
const authToggle = document.getElementById("authToggle");
const authMessage = document.getElementById("authMessage");

const customerForm = document.getElementById("customerForm");
const customerFormSection = document.getElementById("customerFormSection");
const customerList = document.getElementById("customerList");
const searchCustomers = document.getElementById("searchCustomers");

let customers = [];
let currentFilter = "all";
let currentUser = null;
let authMode = "signup";
let dashboardSections = [];

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

function showSuccessToast(message) {
  const toast = document.getElementById("successToast");
  toast.textContent = message;
  toast.hidden = false;
}

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#b42318" : "";
}

function setAuthMode(mode) {
  authMode = mode;

  authHeading.textContent =
    mode === "signup" ? "Create your account" : "Welcome back";

  authSubmit.textContent =
    mode === "signup" ? "Create account" : "Sign in";

  authToggle.textContent =
    mode === "signup"
      ? "Already have an account? Sign in"
      : "New to SalesPilot? Create an account";

  document.getElementById("authPassword").autocomplete =
    mode === "signup" ? "new-password" : "current-password";

  const ownerNameGroup = document.getElementById("ownerNameGroup");
  const ownerNameInput = document.getElementById("ownerNameInput");

  ownerNameGroup.hidden = mode !== "signup";
  ownerNameInput.required = mode === "signup";

  showMessage("");
}

authToggle.addEventListener("click", () => {
  setAuthMode(authMode === "signup" ? "signin" : "signup");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  authSubmit.disabled = true;
  showMessage(authMode === "signup" ? "Creating your account..." : "Signing in...");

  try {
    if (authMode === "signup") {
  const ownerName = document.getElementById("ownerNameInput").value.trim();

  if (!ownerName) {
    showMessage("Please enter the business owner's name.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://worifred.github.io/salespilot/",
      data: {
        owner_name: ownerName
      }
    }
  });

      if (error) throw error;

      if (data.session) {
        showMessage("Account created successfully!");
      } else {
        showMessage("Account created. Check your email for a confirmation link, then sign in.");
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      showMessage("Signed in successfully!");
    }
  } catch (error) {
    showMessage(error.message || "Authentication failed. Please try again.", true);
  } finally {
    authSubmit.disabled = false;
  }
});

// Keep the login screen visible until Supabase confirms a signed-in session.
const main = document.querySelector("main");
dashboardSections = Array.from(main.children).filter(
  element => element.id !== "authSection"
);

const signOutButton = document.createElement("button");
signOutButton.type = "button";
signOutButton.className = "text-btn";
signOutButton.textContent = "Sign out";
signOutButton.hidden = true;
signOutButton.style.marginLeft = "auto";
document.querySelector(".topbar").appendChild(signOutButton);


function updateScreen() {
  const signedIn = Boolean(currentUser);

  authSection.hidden = signedIn;
  dashboardSections.forEach(section => {
    section.hidden = !signedIn;
    customerFormSection.hidden = true;
  });
  signOutButton.hidden = !signedIn;

  const ownerNameLabel = document.getElementById("ownerName");

  if (signedIn && ownerNameLabel) {
    const savedName = currentUser.user_metadata?.owner_name;
    const emailName = currentUser.email
      ? currentUser.email.split("@")[0]
      : "Business owner";

    ownerNameLabel.textContent = savedName || emailName;
  }

  if (!signedIn) {
    customerFormSection.hidden = true;
  }
}

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;

  const { error } = await supabaseClient.auth.signOut();

  signOutButton.disabled = false;

  if (error) {
    alert("Could not sign out: " + error.message);
  }
});

function fromDatabase(row) {
  return {
    id: row.id,
    name: row.customer_name || "",
    phone: row.phone || "",
    product: row.enquiry || "",
    budget: row.budget == null ? "" : String(row.budget),
    lastContact: row.last_contact || "",
    followupDate: row.follow_up_date || "",
    notes: row.notes || "",
    status: row.status === "sold" ? "sold" : "open",
    createdAt: row.created_at
  };
}

async function loadCustomers() {
  if (!currentUser) return;

  customerList.innerHTML = '<p class="empty-state">Loading customers...</p>';

  const { data, error } = await supabaseClient
    .from("customers")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    customerList.innerHTML =
      '<p class="empty-state">Could not load customers. Please refresh and try again.</p>';
    console.error("Load customers error:", error.message);
    return;
  }

  customers = (data || []).map(fromDatabase);
  renderCustomers();
}

function showCustomerForm() {
  if (!currentUser) return;

  customerFormSection.hidden = false;
 showSuccessToast("Customer saved successfully!");
  document.getElementById("customerName").focus();
  customerFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("addCustomerBtn").addEventListener("click", async () => {
  if (!currentUser) {
    showMessage("Please sign in first.", true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("id")
    .eq("user_id", currentUser.id)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .limit(1);

  if (error) {
    showMessage("Could not check your subscription. Please try again.", true);
    return;
  }

   if (!data || data.length === 0) {
    document.getElementById("subscriptionModal").hidden = false;
    return;
  }

  showCustomerForm();
});

document.getElementById("cancelFormBtn").addEventListener("click", () => {
  customerForm.reset();
  customerFormSection.hidden = true;
});

customerForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const submitButton = customerForm.querySelector('[type="submit"]');
  const form = new FormData(customerForm);

  const name = String(form.get("customerName") || "").trim();
  const phone = String(form.get("customerPhone") || "").trim();
  const product = String(form.get("product") || "").trim();
  const budgetValue = String(form.get("budget") || "").trim();
  const lastContact = String(form.get("lastContact") || "");
  const followupDate = String(form.get("followupDate") || "");
  const notes = String(form.get("customerNotes") || "").trim();

  if (!name || !phone || !product || !followupDate) {
    alert("Please fill in all required fields.");
    return;
  }

  const customerRow = {
    user_id: currentUser.id,
    customer_name: name,
    phone,
    enquiry: product,
    budget: budgetValue === "" ? null : Number(budgetValue),
    last_contact: lastContact || null,
    follow_up_date: followupDate,
    follow_up_time: null,
    notes: notes || null,
    message: null,
    status: "pending"
  };

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    const { error } = await supabaseClient
      .from("customers")
      .insert(customerRow);

    if (error) throw error;

    customerForm.reset();
    customerFormSection.hidden = true;
    await loadCustomers();
    const saveMessage = document.getElementById("customerSaveMessage");
saveMessage.textContent = "Customer saved successfully!";
saveMessage.hidden = false;
  } catch (error) {
    console.error("Save customer error:", error.message);
    alert("Could not save the customer: " + error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save customer";
  }
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
  } else if (!phone.startsWith("234") && phone.length === 10) {
    phone = "234" + phone;
  }

  const message = createFollowupMessage(customer);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

function renderCustomers() {
  const today = localDateString();
  const openCustomers = customers.filter(customer => customer.status !== "sold");
  const dueCustomers = openCustomers.filter(
    customer => customer.followupDate && customer.followupDate <= today
  );

  document.getElementById("totalCustomers").textContent = customers.length;
  document.getElementById("todayFollowups").textContent = dueCustomers.length;
  document.getElementById("openCustomers").textContent = openCustomers.length;
  document.getElementById("customerCount").textContent = `${customers.length} saved`;

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
        customer.followupDate &&
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
          ${customer.lastContact
            ? `<p><strong>Last conversation:</strong> ${escapeHTML(customer.lastContact)}</p>`
            : ""}
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

customerList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button || !currentUser) return;

  const customer = customers.find(
    item => String(item.id) === button.dataset.id
  );
  if (!customer) return;

  if (button.dataset.action === "whatsapp") {
    openWhatsApp(customer);
    return;
  }

  if (button.dataset.action === "sold") {
    if (!confirm(`Mark ${customer.name} as a completed sale?`)) return;

    button.disabled = true;

    const { error } = await supabaseClient
      .from("customers")
      .update({ status: "sold" })
      .eq("id", customer.id)
      .eq("user_id", currentUser.id);

    if (error) {
      alert("Could not update this customer: " + error.message);
    } else {
      await loadCustomers();
    }

    button.disabled = false;
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete ${customer.name} from your customer list?`)) return;

    button.disabled = true;

    const { error } = await supabaseClient
      .from("customers")
      .delete()
      .eq("id", customer.id)
      .eq("user_id", currentUser.id);

    if (error) {
      alert("Could not delete this customer: " + error.message);
    } else {
      await loadCustomers();
      showSuccessToast("Customer deleted successfully!");
    }

    button.disabled = false;
  }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;
  updateScreen();

  if (currentUser) {
    // Defer database work until after the auth callback completes.
    setTimeout(() => loadCustomers(), 0);
  } else {
    customers = [];
    renderCustomers();
    showMessage("");
  }
});

async function initializeSalesPilot() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showMessage("Could not check your sign-in status. Please refresh.", true);
    return;
  }

  currentUser = data.session?.user || null;
  updateScreen();

  if (currentUser) {
    await loadCustomers();
  } else {
    renderCustomers();
  }
}

setAuthMode("signin");
initializeSalesPilot();

async function startSubscriptionPayment(plan) {
  const message = document.getElementById("paymentMessage");
  const monthlyButton = document.getElementById("monthlyPlanBtn");
  const yearlyButton = document.getElementById("yearlyPlanBtn");

  if (!currentUser) {
    message.textContent = "Please sign in before subscribing.";
    return;
  }

  message.textContent = "Preparing secure checkout...";
  monthlyButton.disabled = true;
  yearlyButton.disabled = true;

  try {
    const { data: sessionData } =
      await supabaseClient.auth.getSession();

    const token = sessionData.session?.access_token;

    if (!token) {
      throw new Error("Please sign in again.");
    }

    const { data, error } = await supabaseClient.functions.invoke(
      "initialize-payment",
      {
        body: { plan },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (error) {
      throw new Error("Could not start checkout. Please try again.");
    }

    if (!data?.authorization_url) {
      throw new Error(data?.error || "Checkout link was not returned.");
    }

    window.location.href = data.authorization_url;
  } catch (error) {
    message.textContent =
      error.message || "Payment could not be started. Please try again.";
  } finally {
    monthlyButton.disabled = false;
    yearlyButton.disabled = false;
  }
}

document
  .getElementById("monthlyPlanBtn")
  .addEventListener("click", () => startSubscriptionPayment("monthly"));

document
  .getElementById("yearlyPlanBtn")
  .addEventListener("click", () => startSubscriptionPayment("yearly"));
document
  .getElementById("closeSubscriptionModal")
  .addEventListener("click", () => {
    document.getElementById("subscriptionModal").hidden = true;
  });

