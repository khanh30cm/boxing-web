document.addEventListener("DOMContentLoaded", async () => {
  // 1. Đợi Firebase khởi tạo xong (tránh lỗi undefined window.dbFuncs)
  let retryCount = 0;
  while (!window.dbFuncs && retryCount < 10) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    retryCount++;
  }

  if (!window.dbFuncs) {
    console.error("Firebase chưa sẵn sàng. Hãy kiểm tra lại file user.html");
    return;
  }

  const {
    collection,
    getDocs,
    query,
    where,
    addDoc,
    doc,
    updateDoc,
    orderBy,
  } = window.dbFuncs;
  const db = window.db;

  let currentUserDocId = null;
  let currentBalance = 0;
  let cleanMaHV = ""; 

  // --- 1. XỬ LÝ TRA CỨU VÕ SĨ ---
  const btnCheckUser = document.getElementById("btnCheckUser");
  if (btnCheckUser) {
    btnCheckUser.onclick = async () => {
      const phone = document.getElementById("userPhoneInput").value.trim();
      if (!phone) return alert("Vui lòng nhập SĐT!");

      try {
        const q = query(collection(db, "vosi"), where("phone", "==", phone));
        const snap = await getDocs(q);

        if (snap.empty) return alert("Số điện thoại chưa đăng ký!");

        const userDoc = snap.docs[0];
        currentUserDocId = userDoc.id;
        const userData = userDoc.data();
        
        currentBalance = userData.balance || 0;
        cleanMaHV = userData.maHV; 

        showUserInfo(userData);
        loadUserRentals();
        loadShopData();
      } catch (error) {
        console.error("Lỗi tra cứu:", error);
        alert("Lỗi kết nối Firebase: " + error.message);
      }
    };
  }

  function showUserInfo(data) {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("info-section").style.display = "block";
    document.getElementById("disp-name").innerText = data.name;
    document.getElementById("disp-id").innerText = "Mã số: #" + data.maHV;
    document.getElementById("disp-phone").innerText = data.phone;
    document.getElementById("disp-date").innerText = data.date;
    document.getElementById("disp-status").innerText = data.status;
    document.getElementById("disp-balance").innerText = (data.balance || 0).toLocaleString() + "đ";
    document.getElementById("transfer-syntax").innerText = data.maHV + " - " + data.name;

    if (data.expiryDate) {
      const expiry = new Date(data.expiryDate.seconds * 1000);
      const expiryElem = document.getElementById("disp-expiry");
      if(expiryElem) {
        expiryElem.innerText = expiry.toLocaleDateString("vi-VN");
        expiryElem.style.color = expiry < new Date() ? "#ff4d4d" : "#f1c40f";
        if (expiry < new Date()) expiryElem.innerText += " (Hết hạn)";
      }
    }
  }

  // --- 2. GỬI YÊU CẦU NẠP TIỀN (ĐÃ HỢP NHẤT) ---
  const btnSendRequest = document.getElementById("btnSendRequest");
  if (btnSendRequest) {
    btnSendRequest.onclick = async (e) => {
      e.preventDefault();

      if (!cleanMaHV) {
        return alert("Vui lòng tra cứu võ sĩ trước khi gửi yêu cầu!");
      }

      const pkgSelect = document.getElementById("renewalPackage");
      const amount = parseInt(pkgSelect.value);
      const daysAttr = pkgSelect.options[pkgSelect.selectedIndex].getAttribute("data-days");
      const days = parseInt(daysAttr || 30);
      const name = document.getElementById("disp-name").innerText;

      try {
        await addDoc(collection(db, "requests"), {
          userId: cleanMaHV,
          userName: name,
          amount: amount,
          days: days,
          status: "Chờ duyệt",
          createdAt: new Date()
        });

        alert("Gửi yêu cầu thành công! Vui lòng chờ HLV duyệt tiền.");
      } catch (err) {
        console.error("Lỗi gửi yêu cầu:", err);
        alert("Không thể gửi yêu cầu: " + err.message);
      }
    };
  }

  // --- 3. CỬA HÀNG VÀ GIAO DỊCH ---
  async function loadShopData() {
    const shopContainer = document.getElementById("shop-container");
    if (!shopContainer) return;

    const snap = await getDocs(query(collection(db, "inventory"), orderBy("createdAt", "desc")));
    shopContainer.innerHTML = "";

    snap.forEach((dSnap) => {
      const d = dSnap.data();
      if (d.stock <= 0) return;
      const card = document.createElement("div");
      card.className = "shop-card";
      card.innerHTML = `
                <span class="shop-type-tag">${d.type}</span>
                <h5>${d.name}</h5>
                <p class="shop-price">${Number(d.price).toLocaleString()}đ</p>
                <button class="btn-user-action" data-id="${dSnap.id}" data-name="${d.name}" data-stock="${d.stock}" data-type="${d.type}" data-price="${d.price}">
                    ${d.type === "Cho thuê" ? "THUÊ" : "MUA"}
                </button>`;
      shopContainer.appendChild(card);
    });

    shopContainer.querySelectorAll(".btn-user-action").forEach((btn) => {
      btn.onclick = () => {
        const { id, name, stock, type, price } = btn.dataset;
        userTrade(id, name, parseInt(stock), type, parseInt(price));
      };
    });
  }

  async function userTrade(itemId, itemName, stock, type, price) {
    if (currentBalance < price) {
      return alert(`Bạn không đủ tiền! Cần thêm ${(price - currentBalance).toLocaleString()}đ.`);
    }
    if (!confirm(`Xác nhận dùng ${price.toLocaleString()}đ để ${type} ${itemName}?`)) return;

    try {
      const userRef = doc(db, "vosi", currentUserDocId);
      const equipRef = doc(db, "inventory", itemId);
      const newBalance = currentBalance - price;

      await updateDoc(userRef, { balance: newBalance });
      let equipUpdate = { stock: stock - 1 };
      if (type === "Cho thuê") equipUpdate.returnTime = Date.now() + 1 * 3600 * 1000;
      await updateDoc(equipRef, equipUpdate);

      await addDoc(collection(db, "history"), {
        userName: document.getElementById("disp-name").innerText,
        itemName,
        amount: price,
        type,
        time: new Date(),
      });

      alert("Giao dịch thành công!");
      currentBalance = newBalance;
      document.getElementById("disp-balance").innerText = currentBalance.toLocaleString() + "đ";
      loadUserRentals();
      loadShopData();
    } catch (e) {
      alert("Lỗi giao dịch: " + e.message);
    }
  }

  // --- 4. QUẢN LÝ DỤNG CỤ THUÊ ---
  async function loadUserRentals() {
    const rentList = document.getElementById("user-rent-list");
    if (!rentList) return;

    const snap = await getDocs(collection(db, "inventory"));
    rentList.innerHTML = "";
    let hasItem = false;

    snap.forEach((doc) => {
      const d = doc.data();
      if (d.returnTime && d.returnTime > Date.now()) {
        hasItem = true;
        const div = document.createElement("div");
        div.className = "rent-item-user";
        div.innerHTML = `<span>${d.name}</span><strong class="user-timer" data-expire="${d.returnTime}">...</strong>`;
        rentList.appendChild(div);
      }
    });

    if (!hasItem) rentList.innerHTML = "<p class='empty-msg'>Không có dụng cụ thuê.</p>";
  }

  setInterval(() => {
    document.querySelectorAll(".user-timer").forEach((span) => {
      const diff = parseInt(span.getAttribute("data-expire")) - Date.now();
      if (diff <= 0) {
        span.innerText = "Hết hạn";
        span.style.color = "red";
      } else {
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        span.innerText = `${m}p ${s}s`;
      }
    });
  }, 1000);
});