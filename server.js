const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Placeholder image route (must be before static middleware)
app.get('/api/placeholder/:width/:height', (req, res) => {
    const { width, height } = req.params;
    res.redirect(`https://via.placeholder.com/${width}x${height}/e5ccf4/5c509c?text=Car+Image`);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 读取数据文件的辅助函数
const readDataFile = (filename) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', filename), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

const writeDataFile = (filename, data) => {
    try {
        fs.writeFileSync(path.join(__dirname, 'data', filename), JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

// API路由

// 获取所有车辆 - 支持搜索和筛选
app.get('/api/cars', (req, res) => {
    let cars = readDataFile('cars.json');
    const { search, type, brand } = req.query;

    // 搜索功能
    if (search) {
        const searchLower = search.toLowerCase();
        cars = cars.filter(car =>
            car.brand.toLowerCase().includes(searchLower) ||
            car.model.toLowerCase().includes(searchLower) ||
            car.type.toLowerCase().includes(searchLower) ||
            (car.description && car.description.toLowerCase().includes(searchLower))
        );
    }

    // 类型筛选
    if (type) {
        cars = cars.filter(car => car.type.toLowerCase() === type.toLowerCase());
    }

    // 品牌筛选
    if (brand) {
        cars = cars.filter(car => car.brand.toLowerCase() === brand.toLowerCase());
    }

    res.json(cars);
});

// 获取搜索建议
app.get('/api/suggestions', (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);

    const cars = readDataFile('cars.json');
    const suggestions = new Set();
    const queryLower = q.toLowerCase();

    cars.forEach(car => {
        // 添加匹配的品牌
        if (car.brand.toLowerCase().includes(queryLower)) {
            suggestions.add(car.brand);
        }
        // 添加匹配的型号
        if (car.model.toLowerCase().includes(queryLower)) {
            suggestions.add(`${car.brand} ${car.model}`);
        }
        // 添加匹配的类型
        if (car.type.toLowerCase().includes(queryLower)) {
            suggestions.add(car.type);
        }
    });

    res.json(Array.from(suggestions).slice(0, 5));
});

// 获取单个车辆详情
app.get('/api/cars/:vin', (req, res) => {
    const cars = readDataFile('cars.json');
    const car = cars.find(c => c.vin === req.params.vin);

    if (!car) {
        return res.status(404).json({ error: 'Car not found' });
    }

    res.json(car);
});

// 创建订单
app.post('/api/orders', (req, res) => {
    const { vin, customerInfo, rentalPeriod } = req.body;

    // 验证车辆是否可用
    const cars = readDataFile('cars.json');
    const car = cars.find(c => c.vin === vin);

    if (!car || !car.available) {
        return res.status(400).json({ error: 'Car not available' });
    }

    // 创建订单
    const orders = readDataFile('orders.json');
    const order = {
        id: Date.now().toString(),
        vin,
        customerInfo,
        rentalPeriod,
        totalPrice: car.pricePerDay * rentalPeriod.days,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    orders.push(order);

    // 更新车辆可用性
    car.available = false;

    // 保存数据
    if (writeDataFile('orders.json', orders) && writeDataFile('cars.json', cars)) {
        res.json({ success: true, order });
    } else {
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// 确认订单
app.put('/api/orders/:id/confirm', (req, res) => {
    const orders = readDataFile('orders.json');
    const order = orders.find(o => o.id === req.params.id);

    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    order.status = 'confirmed';

    if (writeDataFile('orders.json', orders)) {
        res.json({ success: true, order });
    } else {
        res.status(500).json({ error: 'Failed to confirm order' });
    }
});

// 获取筛选选项
app.get('/api/filters', (req, res) => {
    const cars = readDataFile('cars.json');
    const types = [...new Set(cars.map(car => car.type))];
    const brands = [...new Set(cars.map(car => car.brand))];

    res.json({ types, brands });
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve reservation.html for /reservation
app.get('/reservation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reservation.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});