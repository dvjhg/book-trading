const API_BASE = 'http://localhost:3000/api';

// ========== 购物车 ==========
let cart = JSON.parse(localStorage.getItem('bookCart')) || {};

function saveCart() {
    localStorage.setItem('bookCart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const total = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = total;
        badge.classList.toggle('show', total > 0);
    }
}

// ========== 加载书籍 ==========
async function loadBooks(search = '') {
    const grid = document.getElementById('booksGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading">正在加载书籍...</div>';

    try {
        const url = search ? `${API_BASE}/books?search=${encodeURIComponent(search)}` : `${API_BASE}/books`;
        const res = await fetch(url);
        const data = await res.json();

        grid.innerHTML = '';

        if (data.books.length === 0) {
            grid.innerHTML = '<div class="empty-state">暂无书籍，去卖书板块添加吧！</div>';
            return;
        }

        data.books.forEach(book => {
            const card = createBookCard(book);
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = '<div class="empty-state">加载失败，请检查网络</div>';
    }
}

function createBookCard(book) {
    const div = document.createElement('div');
    div.className = 'book-card';
    
    const inCart = cart[book.id];
    const qty = inCart ? inCart.qty : 0;

    div.innerHTML = `
        <img src="${book.image}" alt="${book.title}" class="book-image" 
            onerror="this.src='data:image/svg+xml,&lt;svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22150%22&gt;&lt;rect fill=%22%23f0f0f0%22 width=%22100%22 height=%22150%22/&gt;&lt;text x=%2250%22 y=%2280%22 text-anchor=%22middle%22 fill=%22%23999%22&gt;暂无图片&lt;/text&gt;&lt;/svg&gt;'">
        <div class="book-info">
            <div class="book-title">${book.title}</div>
            <div style="font-size: 0.8rem; color: #666; margin-top: 4px;">${book.author}</div>
            <div style="font-size: 0.75rem; color: #999; margin-top: 2px;">${book.condition}</div>
            <div class="book-meta">
                <div>
                    <span class="book-price">${book.price}</span>
                    ${book.originalPrice ? `<span class="book-original-price">¥${book.originalPrice}</span>` : ''}
                </div>
                ${qty > 0 ? `
                    <div class="quantity-control">
                        <button class="qty-btn minus" onclick="updateQty('${book.id}', -1, event)">−</button>
                        <span class="qty-num">${qty}</span>
                        <button class="qty-btn plus" onclick="updateQty('${book.id}', 1, event)">+</button>
                    </div>
                ` : `
                    <button class="add-btn" onclick="addToCart('${book.id}', event)">+</button>
                `}
            </div>
        </div>
    `;
    return div;
}

// ========== 购物车操作 ==========
function addToCart(bookId, event) {
    event.stopPropagation();
    cart[bookId] = { qty: 1 };
    saveCart();
    loadBooks(document.getElementById('searchInput')?.value || '');
    showToast('已加入购物车');
}

function updateQty(bookId, delta, event) {
    event.stopPropagation();
    if (!cart[bookId]) return;
    
    cart[bookId].qty += delta;
    if (cart[bookId].qty <= 0) {
        delete cart[bookId];
    }
    saveCart();
    loadBooks(document.getElementById('searchInput')?.value || '');
}

function toggleCart() {
    const panel = document.getElementById('cartPanel');
    if (!panel) return;
    
    const isShow = panel.classList.contains('show');
    if (isShow) {
        panel.classList.remove('show');
    } else {
        renderCart();
        panel.classList.add('show');
    }
}

function renderCart() {
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('totalPrice');
    if (!container) return;

    if (Object.keys(cart).length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">购物车是空的</div>';
        if (totalEl) totalEl.textContent = '0.00';
        return;
    }

    fetch(`${API_BASE}/books`)
        .then(r => r.json())
        .then(data => {
            const booksMap = {};
            data.books.forEach(b => booksMap[b.id] = b);
            
            let total = 0;
            container.innerHTML = '';
            
            Object.entries(cart).forEach(([id, item]) => {
                const book = booksMap[id];
                if (!book) return;
                
                total += book.price * item.qty;
                
                const div = document.createElement('div');
                div.className = 'cart-item';
                div.innerHTML = `
                    <img src="${book.image}" class="cart-item-img" onerror="this.style.display='none'">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${book.title}</div>
                        <div class="cart-item-price">¥${book.price} x ${item.qty}</div>
                        <div style="margin-top:8px;">
                            <button class="qty-btn minus" onclick="updateQty('${id}', -1, event)">−</button>
                            <span class="qty-num">${item.qty}</span>
                            <button class="qty-btn plus" onclick="updateQty('${id}', 1, event)">+</button>
                        </div>
                    </div>
                `;
                container.appendChild(div);
            });
            
            if (totalEl) totalEl.textContent = total.toFixed(2);
        });
}

// ========== 搜索 ==========
function searchBooks() {
    const input = document.getElementById('searchInput');
    loadBooks(input ? input.value : '');
}

// ========== 结算 ==========
function showCheckout() {
    if (Object.keys(cart).length === 0) {
        showToast('购物车是空的');
        return;
    }
    
    const modal = document.getElementById('checkoutModal');
    const totalEl = document.getElementById('finalTotal');
    
    fetch(`${API_BASE}/books`)
        .then(r => r.json())
        .then(data => {
            const booksMap = {};
            data.books.forEach(b => booksMap[b.id] = b);
            let total = 0;
            Object.entries(cart).forEach(([id, item]) => {
                if (booksMap[id]) total += booksMap[id].price * item.qty;
            });
            if (totalEl) totalEl.textContent = total.toFixed(2);
        });
    
    if (modal) modal.classList.add('show');
}

function closeCheckout() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('show');
}

async function submitOrder() {
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    const address = document.getElementById('address').value;
    const time = document.getElementById('expectedTime').value;
    const note = document.getElementById('note').value;

    if (!name || !phone || !address || !time) {
        showToast('请填写完整信息');
        return;
    }

    const res = await fetch(`${API_BASE}/books`);
    const data = await res.json();
    const booksMap = {};
    data.books.forEach(b => booksMap[b.id] = b);

    const items = Object.entries(cart).map(([id, item]) => ({
        bookId: id,
        title: booksMap[id]?.title,
        price: booksMap[id]?.price,
        qty: item.qty
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items,
                totalAmount,
                address,
                expectedTime: time,
                contactName: name,
                contactPhone: phone,
                note
            })
        });

        const result = await response.json();
        
        if (result.success) {
            cart = {};
            saveCart();
            closeCheckout();
            loadBooks();
            showToast('订单提交成功！');
        }
    } catch (err) {
        showToast('提交失败，请重试');
    }
}

// ========== 卖书页面 ==========
function initSellPage() {
    const form = document.getElementById('sellForm');
    const input = document.getElementById('imageInput');
    const preview = document.getElementById('previewGrid');
    const uploadArea = document.getElementById('uploadArea');

    if (!form) return;

    input.addEventListener('change', (e) => {
        preview.innerHTML = '';
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.className = 'preview-img';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#ddd';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const res = await fetch(`${API_BASE}/sell`, {
                method: 'POST',
                body: formData
            });
            
            const result = await res.json();
            
            if (result.success) {
                showToast('提交成功！等待审核');
                form.reset();
                preview.innerHTML = '';
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
        } catch (err) {
            showToast('提交失败，请重试');
        }
    });
}

// ========== 后台管理 ==========
function initAdmin() {
    loadOrders();
    loadSellRequests();
    loadAdminBooks();
}

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-sidebar nav a').forEach(el => el.classList.remove('active'));
    
    const tabEl = document.getElementById(tab + 'Tab');
    if (tabEl) tabEl.classList.remove('hidden');
    
    if (event && event.target) event.target.classList.add('active');
    
    const titles = {
        orders: '购买订单',
        sell: '卖书申请',
        books: '书籍管理'
    };
    const titleEl = document.getElementById('tabTitle');
    if (titleEl) titleEl.textContent = titles[tab];
}

async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    try {
        const res = await fetch(`${API_BASE}/orders`);
        const data = await res.json();
        
        tbody.innerHTML = data.orders.map(order => `
            <tr>
                <td>${order.id.slice(0, 8)}</td>
                <td>${order.items.map(i => `${i.title}x${i.qty}`).join('<br>')}</td>
                <td>¥${order.totalAmount}</td>
                <td>${order.contactName}</td>
                <td>${order.contactPhone}</td>
                <td>${order.address}</td>
                <td>${new Date(order.expectedTime).toLocaleString()}</td>
                <td>${new Date(order.createdAt).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8">加载失败</td></tr>';
    }
}

async function loadSellRequests() {
    const tbody = document.getElementById('sellTableBody');
    if (!tbody) return;
    
    try {
        const res = await fetch(`${API_BASE}/sell`);
        const data = await res.json();
        
        tbody.innerHTML = data.requests.map(req => `
            <tr>
                <td>${req.id.slice(0, 8)}</td>
                <td>${req.title}<br><small>${req.author}</small></td>
                <td>¥${req.price}</td>
                <td>${req.condition}</td>
                <td>${req.contactName}</td>
                <td>${req.contactPhone}</td>
                <td>${req.contactWechat || '-'}</td>
                <td>${req.images.length > 0 ? `<a href="http://localhost:3000${req.images[0]}" target="_blank">查看</a>` : '-'}</td>
                <td>${req.description || '-'}</td>
                <td>${new Date(req.createdAt).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="10">加载失败</td></tr>';
    }
}

async function loadAdminBooks() {
    const tbody = document.getElementById('booksTableBody');
    if (!tbody) return;
    
    try {
        const res = await fetch(`${API_BASE}/books`);
        const data = await res.json();
        
        tbody.innerHTML = data.books.map(book => `
            <tr>
                <td>${book.id.slice(0, 8)}</td>
                <td><img src="http://localhost:3000${book.image}" style="width:40px;height:50px;object-fit:cover;border-radius:4px;"></td>
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>¥${book.price}</td>
                <td>${book.stock}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6">加载失败</td></tr>';
    }
}

function showAddBookModal() {
    showToast('添加书籍功能需要在后台手动添加数据到 backend/data/books.json');
}

// ========== 工具函数 ==========
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// 初始化
updateCartBadge();