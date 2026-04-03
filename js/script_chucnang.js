/**
 * Boxing Club - Admin Logic Full (script_chucnang.js)
 * Tính năng: 
 * 1. Quản lý võ sĩ (Chặn số trong tên)
 * 2. Quản lý dụng cụ dạng Card hiện đại
 * 3. Duyệt nạp tiền/mua gói bằng SweetAlert2 cực đẹp
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Đợi Firebase và dbFuncs sẵn sàng
    await new Promise((resolve) => setTimeout(resolve, 200));

    const {
        collection, addDoc, getDocs, query, orderBy,
        doc, getDoc, deleteDoc, updateDoc, where,
    } = window.dbFuncs;
    const db = window.db;

    const memberTableBody = document.getElementById("memberTableBody");
    const equipTableBody = document.getElementById("equipGrid") || document.getElementById("equipTableBody");
    const requestTableBody = document.getElementById("requestTableBody");

    // --- HÀM KIỂM TRA TÊN HỢP LỆ (Chỉ chữ) ---
    function validateName(name) {
        const regex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểếìỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ\s]+$/;
        return regex.test(name);
    }

    // Ngăn chặn gõ số ngay từ bàn phím
    ["newName", "editName"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.onkeypress = (e) => {
                if (/\d/.test(String.fromCharCode(e.keyCode))) return false;
            };
        }
    });

    // --- 1. QUẢN LÝ VÕ SĨ ---
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

    // --- 2. QUẢN LÝ DỤNG CỤ (GIAO DIỆN THẺ - CARD) ---
    async function loadEquips() {
        if (!equipTableBody) return;
        try {
            const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            equipTableBody.innerHTML = "";
            
            // Ép kiểu hiển thị sang Grid cho đẹp
            equipTableBody.style.display = "grid";

            snap.forEach((dSnap) => {
                const d = dSnap.data();
                const id = dSnap.id;
                const stockClass = d.stock < 5 ? 'stock-low' : 'stock-ok';
                const typeClass = d.type === 'Cho thuê' ? 'badge-rent' : 'badge-sell';

                const card = document.createElement("div");
                card.className = "equip-card";
                card.innerHTML = `
                    <span class="badge-type ${typeClass}">${d.type}</span>
                    <span class="equip-name"><i class="fas fa-mitten"></i> ${d.name}</span>
                    <div class="equip-info">
                        <span class="equip-price">${Number(d.price).toLocaleString()}đ</span>
                        <span class="stock-badge ${stockClass}">Kho: ${d.stock}</span>
                    </div>
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn-delete" style="flex:1; background:#c0392b" onclick="deleteEquip('${id}', '${d.name}')">
                            <i class="fas fa-trash"></i> Xóa kho
                        </button>
                    </div>`;
                equipTableBody.appendChild(card);
            });
        } catch (e) { console.error("Lỗi tải dụng cụ:", e); }
    }

    // --- 3. DUYỆT NẠP TIỀN (GIAO DIỆN & SWEETALERT2) ---
    async function loadDepositRequests() {
        if (!requestTableBody) return;
        try {
            const q = query(collection(db, "requests"), where("status", "==", "Chờ duyệt"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            requestTableBody.innerHTML = "";
            const countBadge = document.getElementById("req-count");
            if (countBadge) countBadge.innerText = snap.size;

            if (snap.empty) {
                requestTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#666;">Không có yêu cầu chờ duyệt.</td></tr>`;
                return;
            }

            snap.forEach((docSnap) => {
                const d = docSnap.data();
                const isSub = d.type === "Mua gói";
                const typeTag = isSub ? `<span style="color:#f1c40f">[MUA GÓI]</span>` : `<span style="color:#2ecc71">[NẠP TIỀN]</span>`;
                const prefix = isSub ? "-" : "+";
                const amountColor = isSub ? "#ff4d4d" : "#2ecc71";
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                <td><strong style="color:#fff">${d.userName}</strong></td>
                <td>#${d.userId} <br> ${typeTag}</td>
                <td><span class="amount-highlight" style="color:${amountColor}">${prefix}${Number(d.amount).toLocaleString()}đ</span></td>
                <td style="color:#888; font-size:12px">${d.createdAt ? d.createdAt.toDate().toLocaleString('vi-VN') : "Vừa xong"}</td>
                <td>
                    <button class="btn-filter-submit" style="background:#f1c40f; color:#000; padding:5px 15px; font-weight:bold" 
                        onclick="approveMoney('${docSnap.id}', '${d.userId}', ${d.amount})">DUYỆT</button>
                </td>`;
                requestTableBody.appendChild(tr);
            });
        } catch (e) { console.error("Lỗi yêu cầu:", e); }
    }

    // --- 4. HÀM DUYỆT TIỀN XỬ LÝ CHÍNH ---
    window.approveMoney = async (reqId, userId, amount) => {
        const result = await Swal.fire({
            title: 'Xác nhận duyệt?',
            text: `Bạn sẽ thực hiện giao dịch ${amount.toLocaleString()}đ cho #${userId}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f1c40f',
            cancelButtonColor: '#333',
            confirmButtonText: 'ĐÚNG, DUYỆT NGAY!',
            background: '#1a1a1a', color: '#fff'
        });

        if (result.isConfirmed) {
            try {
                const reqRef = doc(db, "requests", reqId);
                const reqSnap = await getDoc(reqRef);
                const reqData = reqSnap.data();

                // Lấy thông tin võ sĩ
                const qVosi = query(collection(db, "vosi"), where("maHV", "==", userId.replace("#", "").trim()));
                const snapVosi = await getDocs(qVosi);
                if (snapVosi.empty) throw new Error("Không tìm thấy võ sĩ!");

                const vosiDoc = snapVosi.docs[0];
                const vosiData = vosiDoc.data();
                
                let newBalance = vosiData.balance || 0;
                let newExpiry = vosiData.expiryDate ? vosiData.expiryDate.toDate() : new Date();
                if (newExpiry < new Date()) newExpiry = new Date();

                if (reqData.type === "Mua gói") {
                    if (newBalance < amount) throw new Error("Võ sĩ không đủ tiền trong ví!");
                    newBalance -= amount;
                    newExpiry = new Date(newExpiry.getTime() + (reqData.days || 0) * 24 * 60 * 60 * 1000);
                } else {
                    newBalance += amount;
                }

                // Cập nhật đồng thời
                await updateDoc(doc(db, "vosi", vosiDoc.id), { balance: newBalance, expiryDate: newExpiry, status: "Đang tập" });
                await updateDoc(reqRef, { status: "Đã duyệt" });

                Swal.fire({ title: 'Thành công!', icon: 'success', background: '#1a1a1a', color: '#fff', timer: 1500, showConfirmButton: false });
                loadDepositRequests(); loadMembers();
            } catch (err) {
                Swal.fire('Lỗi!', err.message, 'error');
            }
        }
    };

    // --- 5. THÊM VÕ SĨ MỚI ---
    const addMemberForm = document.getElementById("addMemberForm");
    if (addMemberForm) {
        addMemberForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById("newName").value.trim();
            if (!validateName(name)) return Swal.fire('Thông báo', 'Tên không được chứa số!', 'warning');

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
                Swal.fire('Thành công!', 'Đã thêm võ sĩ mới.', 'success');
                loadMembers();
                addMemberForm.reset();
                document.getElementById("addMemberModal").style.display = "none";
            } catch (err) { Swal.fire('Lỗi!', err.message, 'error'); }
        };
    }

    // --- 6. NHẬP KHO DỤNG CỤ ---
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
                Swal.fire('Đã nhập kho!', '', 'success');
                loadEquips();
                addEquipForm.reset();
                document.getElementById("addEquipModal").style.display = "none";
            } catch (err) { Swal.fire('Lỗi!', err.message, 'error'); }
        };
    }

    // --- ĐIỀU HƯỚNG TAB ---
    document.getElementById("tab-vosi").onclick = () => { switchTab("content-vosi", "tab-vosi"); loadMembers(); };
    document.getElementById("tab-dungcu").onclick = () => { switchTab("content-dungcu", "tab-dungcu"); loadEquips(); };
    document.getElementById("tab-request").onclick = (e) => { e.preventDefault(); switchTab("content-request", "tab-request"); loadDepositRequests(); };

    function switchTab(contentId, tabId) {
        ["content-vosi", "content-dungcu", "content-request"].forEach(id => document.getElementById(id).style.display = "none");
        ["tab-vosi", "tab-dungcu", "tab-request"].forEach(id => document.getElementById(id).classList.remove("active"));
        document.getElementById(contentId).style.display = "block";
        document.getElementById(tabId).classList.add("active");
    }

    // Load dữ liệu ban đầu
    loadMembers();
    loadDepositRequests();
});

// --- CÁC HÀM TOÀN CỤC (WINDOW SCOPE) ---
window.prepEdit = (id, n, p, s) => {
    document.getElementById("editDocId").value = id;
    document.getElementById("editName").value = n;
    document.getElementById("editPhone").value = p;
    document.getElementById("editStatus").value = s;
    document.getElementById("editMemberModal").style.display = "block";
};

window.handleDelete = async (id, name) => {
    const res = await Swal.fire({
        title: 'Xóa võ sĩ?',
        text: `Dữ liệu của ${name} sẽ mất vĩnh viễn!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ĐỒNG Ý XÓA'
    });
    if (res.isConfirmed) {
        await window.dbFuncs.deleteDoc(window.dbFuncs.doc(window.db, "vosi", id));
        Swal.fire('Đã xóa!', '', 'success');
        location.reload();
    }
};

window.deleteEquip = async (id, name) => {
    const res = await Swal.fire({
        title: 'Xóa dụng cụ?',
        text: `Xóa "${name}" khỏi kho hàng?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33'
    });
    if (res.isConfirmed) {
        await window.dbFuncs.deleteDoc(window.dbFuncs.doc(window.db, "inventory", id));
        Swal.fire('Đã xóa!', '', 'success');
        location.reload();
    }
};

// Đóng Modals
document.querySelectorAll(".close-modal").forEach(btn => {
    btn.onclick = () => {
        document.getElementById("addMemberModal").style.display = "none";
        document.getElementById("editMemberModal").style.display = "none";
        document.getElementById("addEquipModal").style.display = "none";
    }
});

document.getElementById("openAddModal").onclick = () => document.getElementById("addMemberModal").style.display = "block";
document.getElementById("openEquipModal").onclick = () => document.getElementById("addEquipModal").style.display = "block";