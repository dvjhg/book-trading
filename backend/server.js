const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 数据文件路径
const dataFile = path.join(__dirname, 'data', 'books.json');
const ordersFile = path.join(__dirname, 'data', 'orders.json');
const sellRequestsFile = path.join(__dirname, 'data', 'sellRequests.json');

// 确保数据文件存在
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ books: [] }, null, 2));
}
if (!fs.existsSync(ordersFile)) {
    fs.writeFileSync(ordersFile, JSON.stringify({ orders: [] }, null, 2));
}
if (!fs.existsSync(sellRequestsFile)) {
    fs.writeFileSync(sellRequestsFile, JSON.stringify({ requests: [] }, null, 2));
}

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ========== 后台管理密码保护 ==========
const ADMIN_PASSWORD = '20060726'; // ← 改成你自己的密码

function checkAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (auth && auth === 'Bearer ' + ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ success: false, message: '未授权' });
    }
}

// 登录验证接口
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: ADMIN_PASSWORD });
    } else {
        res.status(401).json({ success: false, message: '密码错误' });
    }
});

// ========== API 路由 ==========

// 获取所有书籍（前台+后台）
app.get('/api/books', (req, res) => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const search = req.query.search?.toLowerCase() || '';
    
    let books = data.books;
    if (search) {
        books = books.filter(book => 
            book.title.toLowerCase().includes(search) ||
            book.author.toLowerCase().includes(search) ||
            book.isbn?.toLowerCase().includes(search)
        );
    }
    
    res.json({ success: true, books });
});

// 添加书籍（后台上架）
app.post('/api/books', checkAuth, upload.single('image'), (req, res) => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    const newBook = {
        id: uuidv4(),
        title: req.body.title,
        author: req.body.author,
        price: parseFloat(req.body.price),
        originalPrice: parseFloat(req.body.originalPrice) || 0,
        condition: req.body.condition,
        description: req.body.description,
        isbn: req.body.isbn || '',
        image: req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop'),
        stock: parseInt(req.body.stock) || 1,
        seller: req.body.seller || '管理员',
        createdAt: new Date().toISOString()
    };
    
    data.books.push(newBook);
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    
    res.json({ success: true, book: newBook });
});

// 删除书籍（下架）
app.delete('/api/books/:id', checkAuth, (req, res) => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const bookId = req.params.id;
    
    const index = data.books.findIndex(b => b.id === bookId);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '书籍不存在' });
    }
    
    // 删除本地图片
    const book = data.books[index];
    if (book.image && book.image.startsWith('/uploads/')) {
        const imgPath = path.join(__dirname, '..', book.image);
        if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
        }
    }
    
    data.books.splice(index, 1);
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    
    res.json({ success: true, message: '书籍已下架' });
});

// 创建订单
app.post('/api/orders', (req, res) => {
    const data = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    
    const newOrder = {
        id: uuidv4(),
        items: req.body.items,
        totalAmount: req.body.totalAmount,
        address: req.body.address,
        expectedTime: req.body.expectedTime,
        contactName: req.body.contactName,
        contactPhone: req.body.contactPhone,
        note: req.body.note,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    data.orders.push(newOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(data, null, 2));
    
    res.json({ success: true, order: newOrder });
});

// 获取所有订单（后台，需要密码）
app.get('/api/admin/orders', checkAuth, (req, res) => {
    const data = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    res.json({ success: true, orders: data.orders });
});

// 提交卖书申请
app.post('/api/sell', upload.array('images', 5), (req, res) => {
    const data = JSON.parse(fs.readFileSync(sellRequestsFile, 'utf8'));
    
    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    
    const newRequest = {
        id: uuidv4(),
        title: req.body.title,
        author: req.body.author,
        price: parseFloat(req.body.price),
        originalPrice: parseFloat(req.body.originalPrice) || 0,
        condition: req.body.condition,
        description: req.body.description,
        isbn: req.body.isbn || '',
        images: images,
        contactName: req.body.contactName,
        contactPhone: req.body.contactPhone,
        contactWechat: req.body.contactWechat || '',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    data.requests.push(newRequest);
    fs.writeFileSync(sellRequestsFile, JSON.stringify(data, null, 2));
    
    res.json({ success: true, request: newRequest });
});

// 获取所有卖书申请（后台，需要密码）
app.get('/api/admin/sell', checkAuth, (req, res) => {
    const data = JSON.parse(fs.readFileSync(sellRequestsFile, 'utf8'));
    res.json({ success: true, requests: data.requests });
});

// 后台管理页面
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`前台访问: http://localhost:${PORT}`);
    console.log(`后台管理: http://localhost:${PORT}/admin`);
});