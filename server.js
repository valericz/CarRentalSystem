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

// Helper functions for data access
const getCars = () => readDataFile('cars.json');
const getOrders = () => readDataFile('orders.json');
const saveOrders = (orders) => writeDataFile('orders.json', orders);

// Check car availability for given dates
function isCarAvailable(vin, startDate, endDate) {
    const orders = getOrders();

    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);

    // Check for conflicts with existing bookings
    const conflicts = orders.filter(order => {
        if (order.vin !== vin || order.status === 'cancelled') {
            return false;
        }

        const existingStart = new Date(order.rentalPeriod.startDate);
        const existingEnd = new Date(existingStart);
        existingEnd.setDate(existingEnd.getDate() + order.rentalPeriod.days);

        // Check if dates overlap
        return (requestStart < existingEnd && requestEnd > existingStart);
    });

    return conflicts.length === 0;
}

// API endpoint to check availability
app.post('/api/cars/check-availability', (req, res) => {
    try {
        const { vin, startDate, days } = req.body;

        if (!vin || !startDate || !days) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: vin, startDate, days'
            });
        }

        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + parseInt(days));

        const available = isCarAvailable(vin, start, end);

        res.json({
            success: true,
            available: available,
            message: available ? 'Car is available for the requested dates' : 'Car is not available for the requested dates'
        });

    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking car availability'
        });
    }
});

// API路由

// 获取所有车辆 - 支持搜索和筛选
app.get('/api/cars', (req, res) => {
    let cars = getCars();
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

    const cars = getCars();
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
    const cars = getCars();
    const car = cars.find(c => c.vin === req.params.vin);

    if (!car) {
        return res.status(404).json({ error: 'Car not found' });
    }

    res.json(car);
});

// Replace existing order creation endpoint with enhanced version
app.post('/api/orders', (req, res) => {
    try {
        console.log('Creating new order:', req.body);

        const { vin, customerInfo, rentalPeriod, totalPrice } = req.body;

        // Validate required fields
        if (!vin || !customerInfo || !rentalPeriod || !totalPrice) {
            return res.status(400).json({
                success: false,
                message: 'Missing required order information'
            });
        }

        // Check car availability first
        const startDate = new Date(rentalPeriod.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(rentalPeriod.days));

        if (!isCarAvailable(vin, startDate, endDate)) {
            return res.status(409).json({
                success: false,
                message: 'Sorry, this car is not available for the selected dates. Please choose different dates.'
            });
        }

        // Find the car details
        const cars = getCars();
        const selectedCar = cars.find(car => car.vin === vin);

        if (!selectedCar) {
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        // Create order
        const order = {
            id: Date.now().toString(),
            vin: vin,
            selectedCar: selectedCar,
            customerInfo: {
                name: customerInfo.name?.trim(),
                email: customerInfo.email?.trim(),
                phone: customerInfo.phone?.trim(),
                driverLicense: customerInfo.driverLicense?.trim()
            },
            rentalPeriod: {
                startDate: rentalPeriod.startDate,
                days: parseInt(rentalPeriod.days)
            },
            totalPrice: parseFloat(totalPrice),
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Save order
        const orders = getOrders();
        orders.push(order);

        if (!saveOrders(orders)) {
            throw new Error('Failed to save order');
        }

        // Update car availability
        selectedCar.available = false;
        writeDataFile('cars.json', cars);

        console.log('Order created successfully:', order.id);

        res.json({
            success: true,
            message: 'Order created successfully',
            order: order
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order'
        });
    }
});

// 确认订单
app.put('/api/orders/:id/confirm', (req, res) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === req.params.id);

    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    order.status = 'confirmed';

    if (saveOrders(orders)) {
        res.json({ success: true, order });
    } else {
        res.status(500).json({ error: 'Failed to confirm order' });
    }
});

// 获取筛选选项
app.get('/api/filters', (req, res) => {
    const cars = getCars();
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