/**
 * Boxing Club - Admin Logic Full (script_chucnang.js)
 * Cập nhật: Chỉ cho phép tên võ sĩ là ký tự chữ, không dùng số.
 */
document.addEventListener("DOMContentLoaded", async () => {
    // Đợi Firebase và dbFuncs sẵn sàng
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

    // --- HÀM KIỂM TRA TÊN HỢP LỆ (Chỉ chữ và khoảng trắng) ---
    function validateName(name) {
        const regex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểếìỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ\s]+$/;
        return regex.test(name);
    }

    // Ngăn chặn gõ số ngay từ bàn phím cho các ô nhập tên
    const nameInputIds = ["newName", "editName"];
    nameInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.onkeypress = (e) => {
                // Nếu ký tự nhập vào là số (0-9), ngăn chặn không cho nhập
                if (/\d/.test(String.fromCharCode(e.keyCode))) {
                    return false;
                }
            };
        }
    });

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

    // --- 2. XỬ LÝ LƯU SAU KHI SỬA VÕ SĨ (CÓ KIỂM TRA TÊN) ---
    const editMemberForm = document.getElementById("editMemberForm");
    if (editMemberForm) {
        editMemberForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById("editDocId").value;
            const name = document.getElementById("editName").value.trim();
            const phone = document.getElementById("editPhone").value;
            const status = document.getElementById("editStatus").value;

            // Kiểm tra tên hợp lệ
            if (!validateName(name)) {
                return alert("Tên võ sĩ không hợp lệ! Vui lòng chỉ sử dụng chữ cái, không dùng số.");
            }

            try {
                await updateDoc(doc(db, "vosi", id), {
                    name: name,
                    phone: phone,
                    status: status
                });
                alert("Cập nhật thành công!");
                document.getElementById("editMemberModal").style.display = "none";
                loadMembers();
            } catch (err) { alert("Lỗi cập nhật: " + err.message); }
        };
    }

    // --- 3. TẢI DANH SÁCH DỤNG CỤ ---
    async function loadEquips() {
        if (!equipTableBody) return;
        try {
            const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            equipTableBody.innerHTML = "";
            if (snap.empty) {
                equipTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Kho trống.</td></tr>`;
                return;
            }
            snap.forEach((dSnap) => {
                const d = dSnap.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `
                <td><strong>${d.name}</strong></td>
                <td><span class="badge ${d.type === 'Cho thuê' ? 'badge-rent' : 'badge-sell'}">${d.type}</span></td>
                <td>${Number(d.price).toLocaleString()}đ</td>
                <td>${d.stock} cái</td>
                <td>
                    <button class="btn-delete-equip" onclick="deleteEquip('${dSnap.id}')"><i class="fas fa-trash"></i></button>
                </td>`;
                equipTableBody.appendChild(tr);
            });
        } catch (e) { console.error("Lỗi tải dụng cụ:", e); }
    }

    // --- 4. TÌM KIẾM VÕ SĨ ---
    const searchMemberInput = document.getElementById("searchMember");
    if (searchMemberInput) {
        searchMemberInput.oninput = () => {
            const filter = searchMemberInput.value.toLowerCase();
            const rows = memberTableBody.getElementsByTagName("tr");
            for (let i = 0; i < rows.length; i++) {
                const txt = rows[i].textContent || rows[i].innerText;
                rows[i].style.display = txt.toLowerCase().includes(filter) ? "" : "none";
            }
        };
    }

    // --- 5. TÌM KIẾM DỤNG CỤ ---
    const searchEquipInput = document.getElementById("searchEquip");
    if (searchEquipInput) {
        searchEquipInput.oninput = () => {
            const filter = searchEquipInput.value.toLowerCase();
            const rows = equipTableBody.getElementsByTagName("tr");
            for (let i = 0; i < rows.length; i++) {
                const txt = rows[i].textContent || rows[i].innerText;
                rows[i].style.display = txt.toLowerCase().includes(filter) ? "" : "none";
            }
        };
    }

    // --- 6. TẢI DANH SÁCH DUYỆT ---
    async function loadDepositRequests() {
        if (!requestTableBody) return;
        try {
            const q = query(collection(db, "requests"), where("status", "==", "Chờ duyệt"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            requestTableBody.innerHTML = "";
            const countBadge = document.getElementById("req-count");
            if (countBadge) countBadge.innerText = snap.size;
            snap.forEach((docSnap) => {
                const d = docSnap.data();
                const isSub = d.type === "Mua gói";
                const typeTag = isSub ? `<span style="color:#f1c40f; font-size:10px;">[MUA GÓI]</span>` : `<span style="color:#2ecc71; font-size:10px;">[NẠP VÍ]</span>`;
                const prefix = isSub ? "-" : "+";
                const tr = document.createElement("tr");
                tr.innerHTML = `
                <td><strong>${d.userName}</strong></td>
                <td>#${d.userId} ${typeTag}</td>
                <td style="color:${isSub ? '#ff4d4d' : '#2ecc71'}; font-weight:bold;">${prefix}${Number(d.amount).toLocaleString()}đ</td>
                <td>${d.createdAt ? d.createdAt.toDate().toLocaleDateString('vi-VN') : "Mới"}</td>
                <td>
                    <button class="btn-buy" onclick="approveMoney('${docSnap.id}', '${d.userId}', ${d.amount})">DUYỆT</button>
                </td>`;
                requestTableBody.appendChild(tr);
            });
        } catch (e) { console.error("Lỗi tải yêu cầu:", e); }
    }

    // --- 7. HÀM DUYỆT ---
    window.approveMoney = async (reqId, userId, amount) => {
        if (confirm(`Xác nhận duyệt cho võ sĩ ${userId}?`)) {
            try {
                const reqRef = doc(db, "requests", reqId);
                const reqSnap = await getDoc(reqRef);
                const reqData = reqSnap.data();
                const type = reqData.type;
                const addDays = reqData.days || 0;
                const qVosi = query(collection(db, "vosi"), where("maHV", "==", userId.replace("#", "").trim()));
                const snapVosi = await getDocs(qVosi);
                const vosiDoc = snapVosi.docs[0];
                const vosiData = vosiDoc.data();
                const currentBalance = vosiData.balance || 0;
                let newBalance = currentBalance;
                let currentExpiry = vosiData.expiryDate ? vosiData.expiryDate.toDate() : new Date();
                if (currentExpiry < new Date()) currentExpiry = new Date();
                let newExpiry = currentExpiry;
                if (type === "Mua gói") {
                    if (currentBalance < amount) return alert("Võ sĩ không đủ tiền!");
                    newBalance = currentBalance - amount; 
                    newExpiry = new Date(currentExpiry.getTime() + addDays * 24 * 60 * 60 * 1000);
                } else {
                    newBalance = currentBalance + amount;
                }
                await updateDoc(doc(db, "vosi", vosiDoc.id), { balance: newBalance, expiryDate: newExpiry, status: "Đang tập" });
                await updateDoc(reqRef, { status: "Đã duyệt" });
                alert("Thành công!");
                loadDepositRequests(); loadMembers();
            } catch (err) { alert("Lỗi: " + err.message); }
        }
    };

    // --- 8. FORM THÊM MỚI (CÓ KIỂM TRA TÊN) ---
    const addMemberForm = document.getElementById("addMemberForm");
    if (addMemberForm) {
        addMemberForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById("newName").value.trim();
            
            if (!validateName(name)) {
                return alert("Tên võ sĩ không hợp lệ! Vui lòng chỉ sử dụng chữ cái, không dùng số.");
            }

            try {
                await addDoc(collection(db, "vosi"), {
                    name: name,
                    phone: document.getElementById("newPhone").value,
                    date: document.getElementById("newDate").value,
                    status: document.getElementById("newStatus").value,
                    maHV: "HV" + Math.floor(1000 + Math.random() * 9000),
                    balance: 0,
                    createdAt: new Date()
                });
                alert("Thêm võ sĩ thành công!");
                loadMembers();
                addMemberForm.reset();
                document.getElementById("addMemberModal").style.display = "none";
            } catch (err) { alert(err.message); }
        };
    }

    const addEquipForm = document.getElementById("addEquipForm");
    if (addEquipForm) {
        addEquipForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
                await addDoc(collection(db, "inventory"), {
                    name: document.getElementById("equipName").value,
                    type: document.getElementById("equipType").value,
                    price: Number(document.getElementById("equipPrice").value),
                    stock: parseInt(document.getElementById("equipStock").value),
                    createdAt: new Date()
                });
                alert("Nhập kho thành công!");
                loadEquips();
                addEquipForm.reset();
                document.getElementById("addEquipModal").style.display = "none";
            } catch (err) { alert(err.message); }
        };
    }

    // --- 9. ĐIỀU HƯỚNG TAB ---
    document.getElementById("tab-vosi").onclick = () => { switchTab("content-vosi", "tab-vosi"); loadMembers(); };
    document.getElementById("tab-dungcu").onclick = () => { switchTab("content-dungcu", "tab-dungcu"); loadEquips(); };
    document.getElementById("tab-request").onclick = (e) => { e.preventDefault(); switchTab("content-request", "tab-request"); loadDepositRequests(); };

    function switchTab(contentId, tabId) {
        ["content-vosi", "content-dungcu", "content-request"].forEach(id => document.getElementById(id).style.display = "none");
        ["tab-vosi", "tab-dungcu", "tab-request"].forEach(id => document.getElementById(id).classList.remove("active"));
        document.getElementById(contentId).style.display = "block";
        document.getElementById(tabId).classList.add("active");
    }

    loadMembers();
    loadDepositRequests();
});

// --- WINDOW SCOPE ---
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

document.querySelectorAll(".close-modal").forEach(btn => {
    btn.onclick = () => ["addMemberModal", "editMemberModal", "addEquipModal"].forEach(m => document.getElementById(m).style.display = "none");
});

document.getElementById("openAddModal").onclick = () => document.getElementById("addMemberModal").style.display = "block";
document.getElementById("openEquipModal").onclick = () => document.getElementById("addEquipModal").style.display = "block";