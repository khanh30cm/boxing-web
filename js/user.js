document.addEventListener("DOMContentLoaded", async () => {
  // 1. Đợi Firebase khởi tạo xong
  let retryCount = 0;
  while (!window.dbFuncs && retryCount < 10) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    retryCount++;
  }

  if (!window.dbFuncs) return;

  const { collection, getDocs, query, where, addDoc, doc, updateDoc, orderBy } = window.dbFuncs;
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
        loadUserRentals(); // Gọi hàm tải đồ thuê sau khi có cleanMaHV
        loadShopData();
      } catch (error) {
        alert("Lỗi kết nối Firebase!");
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
      }
    }
  }

  // --- 2. XỬ LÝ MUA GÓI TẬP ---
  const btnSubscribe = document.getElementById("btnSubscribe");
  if (btnSubscribe) {
    btnSubscribe.onclick = async () => {
      if (!cleanMaHV) return alert("Vui lòng tra cứu võ sĩ trước!");
      const pkgSelect = document.getElementById("subscribePackage");
      const price = parseInt(pkgSelect.value);
      const days = parseInt(pkgSelect.options[pkgSelect.selectedIndex].getAttribute("data-days") || 0);

      if (currentBalance < price) {
        return alert(`Số dư không đủ! Gói này ${price.toLocaleString()}đ nhưng ví chỉ còn ${currentBalance.toLocaleString()}đ.`);
      }

      if (!confirm(`Xác nhận dùng ${price.toLocaleString()}đ từ ví để mua gói ${days} ngày?`)) return;

      try {
        await addDoc(collection(db, "requests"), {
          userId: cleanMaHV,
          userName: document.getElementById("disp-name").innerText,
          amount: price,
          days: days,
          type: "Mua gói",
          status: "Chờ duyệt",
          createdAt: new Date()
        });
        alert("Đã gửi yêu cầu mua gói!");
      } catch (err) {
        alert("Lỗi: " + err.message);
      }
    };
  }

  // --- 3. XỬ LÝ NẠP TIỀN ---
  const btnDepositRequest = document.getElementById("btnDepositRequest");
  if (btnDepositRequest) {
    btnDepositRequest.onclick = async () => {
      if (!cleanMaHV) return alert("Vui lòng tra cứu võ sĩ trước!");
      const amount = parseInt(document.getElementById("depositAmount").value);
      try {
        await addDoc(collection(db, "requests"), {
          userId: cleanMaHV,
          userName: document.getElementById("disp-name").innerText,
          amount: amount,
          days: 0,
          type: "Nạp tiền", 
          status: "Chờ duyệt",
          createdAt: new Date()
        });
        alert("Đã gửi yêu cầu nạp tiền!");
      } catch (err) {
        alert("Lỗi: " + err.message);
      }
    };
  }

  // --- 4. CỬA HÀNG VÀ GIAO DỊCH ---
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
      if (type === "Cho thuê") {
        equipUpdate.returnTime = Date.now() + 1 * 3600 * 1000;
        equipUpdate.renterId = cleanMaHV; // FIX: Lưu ID người thuê vào sản phẩm
      }
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
      alert("Lỗi giao dịch!");
    }
  }

  // --- 5. QUẢN LÝ DỤNG CỤ THUÊ (FIX LỖI HIỂN THỊ NHẦM) ---
  async function loadUserRentals() {
    const rentList = document.getElementById("user-rent-list");
    if (!rentList || !cleanMaHV) return;

    const snap = await getDocs(collection(db, "inventory"));
    rentList.innerHTML = "";
    let hasItem = false;

    snap.forEach((doc) => {
      const d = doc.data();
      const now = Date.now();
      
      // ĐIỀU KIỆN: Phải còn hạn thuê VÀ renterId phải khớp với người đang xem
      if (d.returnTime && d.returnTime > now && d.renterId === cleanMaHV) {
        hasItem = true;
        const div = document.createElement("div");
        div.className = "rent-item-user";
        div.innerHTML = `<span><i class="fas fa-mitten"></i> ${d.name}</span> <strong class="user-timer" data-expire="${d.returnTime}">...</strong>`;
        rentList.appendChild(div);
      }
    });

    if (!hasItem) rentList.innerHTML = "<p class='empty-msg'>Bạn không có dụng cụ thuê.</p>";
  }

  // Timer cập nhật mỗi giây
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