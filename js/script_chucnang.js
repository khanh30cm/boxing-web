/**
 * Boxing Club - Admin Logic Full (script_chucnang.js)
 */
document.addEventListener("DOMContentLoaded", async () => {
    // Đợi Firebase sẵn sàng
    await new Promise((resolve) => setTimeout(resolve, 200));

    const {
        collection,
        addDoc,
        getDocs,
        query,
        orderBy,
        doc,
        getDoc,
        deleteDoc,
        updateDoc,
        where,
    } = window.dbFuncs;
    const db = window.db;

    const memberTableBody = document.getElementById("memberTableBody");
    const equipTableBody = document.getElementById("equipTableBody");
    const requestTableBody = document.getElementById("requestTableBody");
    const buyModal = document.getElementById("buyModal");

    // --- 1. TẢI DANH SÁCH VÕ SĨ ---
    async function loadMembers() {
        if (!memberTableBody) return;
        try {
            const q = query(collection(db, "vosi"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            memberTableBody.innerHTML = "";
            snap.forEach((dSnap) => {
                const d = dSnap.data();
                const id = dSnap.id;
                const tr = document.createElement("tr");
                tr.className = "master-row";
                tr.innerHTML = `
                <td>#${d.maHV}</td>
                <td><strong class="name-highlight">${d.name}</strong></td>
                <td>${d.phone}</td>
                <td>${d.date}</td>
                <td><span class="badge active">${d.status}</span></td>
                <td>
                    <button class="btn-edit" onclick="prepEdit('${id}','${d.name}','${d.phone}','${d.status}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-delete" onclick="handleDelete('${id}','${d.name}')"><i class="fas fa-trash"></i></button>
                </td>`;
                memberTableBody.appendChild(tr);
            });
        } catch (e) { console.error("Lỗi tải võ sĩ:", e); }
    }

    // --- 2. TẢI DANH SÁCH DỤNG CỤ ---
    async function loadEquips() {
        if (!equipTableBody) return;
        try {
            const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            equipTableBody.innerHTML = "";
            snap.forEach((dSnap) => {
                const d = dSnap.data();
                const id = dSnap.id;
                const now = Date.now();
                const isRenting = d.type === "Cho thuê" && d.returnTime && d.returnTime > now;
                const isOutOfStock = d.stock <= 0;
                const tr = document.createElement("tr");
                tr.className = "equip-row";
                tr.innerHTML = `
                <td><strong>${d.name}</strong></td>
                <td><span class="badge ${d.type === "Cho thuê" ? "badge-rent" : "badge-sell"}">${d.type}</span></td>
                <td>${Number(d.price).toLocaleString()}đ</td>
                <td class="${isOutOfStock ? "out-of-stock" : ""}">${isOutOfStock ? "Hết hàng" : d.stock + " cái"}</td>
                <td>
                    ${isRenting
                        ? `<span class="timer-countdown" data-expire="${d.returnTime}" data-id="${id}"></span>`
                        : `<button class="btn-buy" onclick="openBuyModal('${id}', '${d.name}', ${d.stock}, '${d.type}')" ${isOutOfStock ? "disabled" : ""}>
                            <i class="fas fa-shopping-cart"></i> ${d.type === "Cho thuê" ? "THUÊ" : "MUA"}
                        </button>`
                    }
                    <button class="btn-delete-equip" onclick="deleteEquip('${id}')"><i class="fas fa-trash"></i></button>
                </td>`;
                equipTableBody.appendChild(tr);
            });
        } catch (e) { console.error("Lỗi tải dụng cụ:", e); }
    }

    // --- 3. TẢI DANH SÁCH DUYỆT NẠP TIỀN ---
    async function loadDepositRequests() {
        if (!requestTableBody) return;
        try {
            const q = query(collection(db, "requests"), where("status", "==", "Chờ duyệt"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            requestTableBody.innerHTML = "";

            const countBadge = document.getElementById("req-count");
            if (countBadge) countBadge.innerText = snap.size;

            if (snap.empty) {
                requestTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Không có yêu cầu nạp tiền nào mới.</td></tr>`;
                return;
            }

            snap.forEach((docSnap) => {
                const d = docSnap.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `
                <td><strong>${d.userName}</strong></td>
                <td>#${d.userId}</td>
                <td style="color:#2ecc71; font-weight:bold;">+${Number(d.amount).toLocaleString()}đ</td>
                <td>${d.createdAt ? d.createdAt.toDate().toLocaleDateString('vi-VN') : "Mới"}</td>
                <td>
                    <button class="btn-buy" onclick="approveMoney('${docSnap.id}', '${d.userId}', ${d.amount})">DUYỆT</button>
                </td>`;
                requestTableBody.appendChild(tr);
            });
        } catch (e) { console.error("Lỗi tải yêu cầu nạp:", e); }
    }

    // --- 4. HÀM DUYỆT TIỀN VÀ GIA HẠN ---
    window.approveMoney = async (reqId, userId, amount) => {
        if (confirm(`Xác nhận duyệt nạp ${Number(amount).toLocaleString()}đ cho võ sĩ ${userId}?`)) {
            try {
                const reqRef = doc(db, "requests", reqId);
                const reqSnap = await getDoc(reqRef);
                if (!reqSnap.exists()) return alert("Yêu cầu không tồn tại!");
                const addDays = reqSnap.data().days || 0;

                const qVosi = query(collection(db, "vosi"), where("maHV", "==", userId.replace("#", "").trim()));
                const snapVosi = await getDocs(qVosi);
                if (snapVosi.empty) return alert("Không tìm thấy hồ sơ võ sĩ!");

                const vosiDoc = snapVosi.docs[0];
                const vosiData = vosiDoc.data();

                let currentExpiry = vosiData.expiryDate ? vosiData.expiryDate.toDate() : new Date();
                if (currentExpiry < new Date()) currentExpiry = new Date();
                const newExpiry = new Date(currentExpiry.getTime() + addDays * 24 * 60 * 60 * 1000);

                await updateDoc(doc(db, "vosi", vosiDoc.id), {
                    balance: (vosiData.balance || 0) + parseInt(amount),
                    expiryDate: newExpiry,
                    status: "Đang tập",
                });
                await updateDoc(reqRef, { status: "Đã duyệt" });

                alert(`Thành công! Đã gia hạn đến: ${newExpiry.toLocaleDateString('vi-VN')}`);
                loadDepositRequests();
            } catch (err) { alert("Lỗi khi duyệt: " + err.message); }
        }
    };

    // --- 5. THÊM VÕ SĨ MỚI ---
    const addMemberForm = document.getElementById("addMemberForm");
    if (addMemberForm) {
        addMemberForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const name = document.getElementById("newName").value;
                const phone = document.getElementById("newPhone").value;
                const date = document.getElementById("newDate").value;
                const status = document.getElementById("newStatus").value;

                await addDoc(collection(db, "vosi"), {
                    name, phone, date, status,
                    maHV: "HV" + Math.floor(1000 + Math.random() * 9000),
                    balance: 0,
                    createdAt: new Date()
                });
                alert("Thêm võ sĩ thành công!");
                addMemberForm.reset();
                document.getElementById("addMemberModal").style.display = "none";
                loadMembers();
            } catch (err) { alert("Lỗi: " + err.message); }
        };
    }

    // --- 6. NHẬP KHO DỤNG CỤ ---
    const addEquipForm = document.getElementById("addEquipForm");
    if (addEquipForm) {
        addEquipForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const name = document.getElementById("equipName").value;
                const type = document.getElementById("equipType").value;
                const price = document.getElementById("equipPrice").value;
                const stock = document.getElementById("equipStock").value;

                await addDoc(collection(db, "inventory"), {
                    name, type, 
                    price: Number(price), 
                    stock: parseInt(stock),
                    createdAt: new Date()
                });
                alert("Nhập kho thành công!");
                addEquipForm.reset();
                document.getElementById("addEquipModal").style.display = "none";
                loadEquips();
            } catch (err) { alert("Lỗi: " + err.message); }
        };
    }

    // --- 7. ĐIỀU HƯỚNG TAB ---
    function hideAllSections() {
        document.getElementById("content-vosi").style.display = "none";
        document.getElementById("content-dungcu").style.display = "none";
        document.getElementById("content-request").style.display = "none";
        document.getElementById("tab-vosi").classList.remove("active");
        document.getElementById("tab-dungcu").classList.remove("active");
        document.getElementById("tab-request").classList.remove("active");
    }

    document.getElementById("tab-vosi").onclick = () => {
        hideAllSections();
        document.getElementById("content-vosi").style.display = "block";
        document.getElementById("tab-vosi").classList.add("active");
        loadMembers();
    };
    document.getElementById("tab-dungcu").onclick = () => {
        hideAllSections();
        document.getElementById("content-dungcu").style.display = "block";
        document.getElementById("tab-dungcu").classList.add("active");
        loadEquips();
    };
    document.getElementById("tab-request").onclick = (e) => {
        e.preventDefault();
        hideAllSections();
        document.getElementById("content-request").style.display = "block";
        document.getElementById("tab-request").classList.add("active");
        loadDepositRequests();
    };

    // Khởi tạo ban đầu
    loadMembers();
    loadDepositRequests();
});

// --- CÁC HÀM WINDOW SCOPE (Sửa/Xóa/Modal) ---
window.prepEdit = (id, n, p, s) => {
    document.getElementById("editDocId").value = id;
    document.getElementById("editName").value = n;
    document.getElementById("editPhone").value = p;
    document.getElementById("editStatus").value = s;
    document.getElementById("editMemberModal").style.display = "block";
};

window.handleDelete = async (id, name) => {
    if (confirm(`Xóa võ sĩ ${name}?`)) {
        await window.dbFuncs.deleteDoc(window.dbFuncs.doc(window.db, "vosi", id));
        alert("Đã xóa!"); location.reload();
    }
};

window.deleteEquip = async (id) => {
    if (confirm("Xóa dụng cụ này?")) {
        await window.dbFuncs.deleteDoc(window.dbFuncs.doc(window.db, "inventory", id));
        alert("Đã xóa!"); location.reload();
    }
};

// Đóng mở Modal cơ bản
const modals = ["addMemberModal", "editMemberModal", "addEquipModal", "buyModal"];
document.querySelectorAll(".close-modal").forEach((btn) => {
    btn.onclick = () => {
        modals.forEach(m => document.getElementById(m).style.display = "none");
    };
});

document.getElementById("openAddModal").onclick = () => document.getElementById("addMemberModal").style.display = "block";
document.getElementById("openEquipModal").onclick = () => document.getElementById("addEquipModal").style.display = "block";

window.onclick = (e) => {
    modals.forEach((id) => {
        const modal = document.getElementById(id);
        if (e.target == modal) modal.style.display = "none";
    });
};