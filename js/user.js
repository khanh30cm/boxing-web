document.addEventListener("DOMContentLoaded", async () => {
  // 1. Đợi Firebase khởi tạo xong
  let retryCount = 0;
  while (!window.dbFuncs && retryCount < 10) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    retryCount++;
  }

  if (!retryCount >= 10) return;

  const { collection, getDocs, query, where, addDoc, doc, updateDoc, orderBy } = window.dbFuncs;
  const db = window.db;
  const auth = window.auth;

  // Biến toàn cục trong file
  window.currentUserDocId = null;
  window.currentBalance = 0;
  window.cleanMaHV = "";

  // --- 1. HÀM TẢI DỮ LIỆU VÕ SĨ THEO EMAIL ---
  window.loadUserDataByEmail = async (email) => {
    try {
      const q = query(collection(db, "vosi"), where("email", "==", email));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert("Không tìm thấy hồ sơ võ sĩ!");
        return;
      }

      const userDoc = snap.docs[0];
      window.currentUserDocId = userDoc.id;
      const userData = userDoc.data();

      window.currentBalance = userData.balance || 0;
      window.cleanMaHV = userData.maHV;

      // Hiển thị thông tin
      showUserInfo(userData);
      
      // Chuyển đổi màn hình
      document.getElementById("loading-section").style.display = "none";
      document.getElementById("info-section").style.display = "block";

      // Tải dữ liệu phụ
      loadUserRentals();
      loadShopData();
    } catch (error) {
      console.error("Lỗi:", error);
    }
  };

  function showUserInfo(data) {
    document.getElementById("disp-name").innerText = data.name;
    document.getElementById("disp-id").innerText = "Mã số: #" + data.maHV;
    document.getElementById("disp-phone").innerText = data.phone || "Chưa có SĐT";
    document.getElementById("disp-date").innerText = data.date;
    document.getElementById("disp-status").innerText = data.status;
    document.getElementById("disp-balance").innerText = (data.balance || 0).toLocaleString() + "đ";
    document.getElementById("transfer-syntax").innerText = data.maHV + " - " + data.name;

    const expiryElem = document.getElementById("disp-expiry");
    if (data.expiryDate) {
      const expiry = new Date(data.expiryDate.seconds * 1000);
      expiryElem.innerText = expiry.toLocaleDateString("vi-VN");
      expiryElem.style.color = expiry < new Date() ? "#ff4d4d" : "#f1c40f";
      if (expiry < new Date()) expiryElem.innerText += " (Hết hạn)";
    } else {
      expiryElem.innerText = "Chưa đăng ký";
    }
  }

  // --- 2. XỬ LÝ CHỈNH SỬA HỒ SƠ ---
  const btnSaveProfile = document.getElementById("btnSaveProfile");
  if (btnSaveProfile) {
    btnSaveProfile.onclick = async () => {
      const newName = document.getElementById("editNameInput").value.trim();
      const newPhone = document.getElementById("editPhoneInput").value.trim();

      // Kiểm tra tên không chứa số
      if (/\d/.test(newName)) return alert("Tên không được chứa chữ số!");
      if (newPhone.length < 10) return alert("Số điện thoại không hợp lệ!");

      try {
        const userRef = doc(db, "vosi", window.currentUserDocId);
        await updateDoc(userRef, {
          name: newName,
          phone: newPhone
        });

        alert("Cập nhật hồ sơ thành công!");
        window.closeEditModal();
        // Reload dữ liệu hiển thị
        window.loadUserDataByEmail(auth.currentUser.email);
      } catch (error) {
        alert("Lỗi: " + error.message);
      }
    };
  }

  // --- 3. XỬ LÝ MUA GÓI TẬP ---
  const btnSubscribe = document.getElementById("btnSubscribe");
  if (btnSubscribe) {
    btnSubscribe.onclick = async () => {
      const pkgSelect = document.getElementById("subscribePackage");
      const price = parseInt(pkgSelect.value);
      const days = parseInt(pkgSelect.options[pkgSelect.selectedIndex].getAttribute("data-days") || 0);

      if (window.currentBalance < price) {
        return alert(`Ví không đủ tiền! Cần thêm ${(price - window.currentBalance).toLocaleString()}đ.`);
      }

      if (!confirm(`Xác nhận mua gói ${days} ngày?`)) return;

      try {
        await addDoc(collection(db, "requests"), {
          userId: window.cleanMaHV,
          userName: document.getElementById("disp-name").innerText,
          amount: price,
          days: days,
          type: "Mua gói",
          status: "Chờ duyệt",
          createdAt: new Date()
        });
        alert("Đã gửi yêu cầu mua gói! Chờ HLV duyệt.");
      } catch (err) { alert(err.message); }
    };
  }

  // --- 4. XỬ LÝ NẠP TIỀN ---
  const btnDepositRequest = document.getElementById("btnDepositRequest");
  if (btnDepositRequest) {
    btnDepositRequest.onclick = async () => {
      const amount = parseInt(document.getElementById("depositAmount").value);
      try {
        await addDoc(collection(db, "requests"), {
          userId: window.cleanMaHV,
          userName: document.getElementById("disp-name").innerText,
          amount: amount,
          type: "Nạp tiền",
          status: "Chờ duyệt",
          createdAt: new Date()
        });
        alert("Yêu cầu nạp tiền đã gửi!");
      } catch (err) { alert(err.message); }
    };
  }

  // --- 5. CỬA HÀNG ---
  async function loadShopData() {
    const shopContainer = document.getElementById("shop-container");
    if (!shopContainer) return;
    const snap = await getDocs(query(collection(db, "inventory"), orderBy("createdAt", "desc")));
    shopContainer.innerHTML = "";
    snap.forEach((dSnap) => {
      const d = dSnap.data();
      if (d.stock <= 0) return;
      const div = document.createElement("div");
      div.className = "shop-card";
      div.style = "background:#222; padding:10px; border-radius:10px; width:120px; text-align:center; border:1px solid #333";
      div.innerHTML = `
        <small style="color:#aaa">${d.type}</small>
        <h6 style="margin:5px 0">${d.name}</h6>
        <p style="color:#f1c40f; font-size:12px">${Number(d.price).toLocaleString()}đ</p>
        <button class="btn-user-action" data-id="${dSnap.id}" data-name="${d.name}" data-stock="${d.stock}" data-type="${d.type}" data-price="${d.price}" style="background:#f1c40f; border:none; padding:5px; border-radius:5px; cursor:pointer; font-size:10px; width:100%">
          ${d.type === "Cho thuê" ? "THUÊ" : "MUA"}
        </button>`;
      shopContainer.appendChild(div);
    });

    shopContainer.querySelectorAll(".btn-user-action").forEach(btn => {
      btn.onclick = () => {
        const { id, name, stock, type, price } = btn.dataset;
        userTrade(id, name, parseInt(stock), type, parseInt(price));
      };
    });
  }

  async function userTrade(itemId, itemName, stock, type, price) {
    if (window.currentBalance < price) return alert("Ví không đủ tiền!");
    if (!confirm(`Xác nhận ${type} ${itemName}?`)) return;
    try {
      const userRef = doc(db, "vosi", window.currentUserDocId);
      const equipRef = doc(db, "inventory", itemId);
      const newBal = window.currentBalance - price;
      await updateDoc(userRef, { balance: newBal });
      let updateObj = { stock: stock - 1 };
      if (type === "Cho thuê") {
        updateObj.returnTime = Date.now() + 3600000;
        updateObj.renterId = window.cleanMaHV;
      }
      await updateDoc(equipRef, updateObj);
      window.loadUserDataByEmail(auth.currentUser.email);
      alert("Giao dịch thành công!");
    } catch (e) { alert("Lỗi giao dịch!"); }
  }

  // --- 6. DỤNG CỤ THUÊ ---
  async function loadUserRentals() {
    const rentList = document.getElementById("user-rent-list");
    if (!rentList) return;
    const snap = await getDocs(collection(db, "inventory"));
    rentList.innerHTML = "";
    let hasItem = false;
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.returnTime && d.returnTime > Date.now() && d.renterId === window.cleanMaHV) {
        hasItem = true;
        const div = document.createElement("div");
        div.style = "background:#222; padding:10px; margin:5px 0; border-radius:5px; display:flex; justify-content:space-between; font-size:13px";
        div.innerHTML = `<span>${d.name}</span><strong class="user-timer" data-expire="${d.returnTime}" style="color:#f1c40f">...</strong>`;
        rentList.appendChild(div);
      }
    });
    if (!hasItem) rentList.innerHTML = "<p style='font-size:12px; color:#666'>Không có đồ thuê.</p>";
  }

  setInterval(() => {
    document.querySelectorAll(".user-timer").forEach((span) => {
      const diff = parseInt(span.getAttribute("data-expire")) - Date.now();
      if (diff <= 0) { span.innerText = "Hết hạn"; span.style.color = "red"; } 
      else {
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        span.innerText = `${m}p ${s}s`;
      }
    });
  }, 1000);
});
// --- LOGIC ĐÓNG/MỞ MODAL ---
window.openEditModal = () => {
    // Đổ dữ liệu hiện tại vào ô nhập
    document.getElementById("editNameInput").value = document.getElementById("disp-name").innerText;
    document.getElementById("editPhoneInput").value = document.getElementById("disp-phone").innerText;
    document.getElementById("editProfileModal").style.display = "block";
};

window.closeEditModal = () => {
    document.getElementById("editProfileModal").style.display = "none";
};

// --- LOGIC LƯU THÔNG TIN ---
const btnSaveProfile = document.getElementById("btnSaveProfile");
if (btnSaveProfile) {
    btnSaveProfile.onclick = async () => {
        const newName = document.getElementById("editNameInput").value.trim();
        const newPhone = document.getElementById("editPhoneInput").value.trim();

        // Kiểm tra hợp lệ
        if (/\d/.test(newName)) return alert("Tên không được chứa số!");
        if (newPhone.length < 10) return alert("Số điện thoại không hợp lệ!");

        try {
            const { doc, updateDoc } = window.dbFuncs;
            const db = window.db;
            
            // Sử dụng currentUserDocId đã lấy được khi load trang
            const userRef = doc(db, "vosi", window.currentUserDocId);

            await updateDoc(userRef, {
                name: newName,
                phone: newPhone
            });

            alert("Cập nhật hồ sơ thành công!");
            window.closeEditModal();
            
            // Tải lại dữ liệu để cập nhật giao diện ngay lập tức
            if (window.auth.currentUser) {
                window.loadUserDataByEmail(window.auth.currentUser.email);
            }
        } catch (error) {
            console.error("Lỗi cập nhật:", error);
            alert("Không thể lưu thông tin!");
        }
    };
}