const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// 🎯 内存存储 - 解决 Vercel serverless 无法写文件的问题
let carsData = [];
let ordersData = [];

// 初始化数据
const initializeData = () => {
    try {
        // 读取初始数据
        carsData = readDataFile('cars.json');
        ordersData = readDataFile('orders.json');
        console.log('✅ 数据初始化完成:', { cars: carsData.length, orders: ordersData.length });
    } catch (error) {
        console.error('❌ 数据初始化失败:', error);
        // 如果读取失败，使用默认数据
        carsData = getDefaultCarsData();
        ordersData = [];
    }
};

// 默认车辆数据（防止文件读取失败）
const getDefaultCarsData = () => [
    {
        "vin": "1HGCM82633A123456",
        "brand": "Toyota",
        "model": "Camry",
        "type": "Sedan",
        "year": 2023,
        "mileage": 15000,
        "fuelType": "Gasoline",
        "pricePerDay": 45,
        "available": true,
        "image": "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb",
        "description": "Reliable and fuel-efficient sedan perfect for business trips and daily commuting."
    },
    {
        "vin": "2HGCM82633A654321",
        "brand": "Honda",
        "model": "Accord",
        "type": "Sedan",
        "year": 2022,
        "mileage": 22000,
        "fuelType": "Gasoline",
        "pricePerDay": 42,
        "available": true,
        "image": "https://images.unsplash.com/photo-1617469767053-d3b523a0b982",
        "description": "Spacious and comfortable sedan with excellent safety ratings."
    }
];

// Placeholder image route (must be before static middleware)
app.get('/api/placeholder/:width/:height', (req, res) => {
    const { width, height } = req.params;
    res.redirect(`https://via.placeholder.com/${width}x${height}/e5ccf4/5c509c?text=Car+Image`);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 读取数据文件的辅助函数（仅用于初始化）
const readDataFile = (filename) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', filename), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

// 🎯 修改后的数据访问函数 - 使用内存存储
const getCars = () => carsData;
const getOrders = () => ordersData;
const saveOrders = (orders) => {
    ordersData = [...orders]; // 创建副本
    console.log('✅ 订单保存到内存:', orders.length);
    return true; // 内存存储总是成功
};

const saveCars = (cars) => {
    carsData = [...cars]; // 创建副本
    console.log('✅ 车辆数据保存到内存:', cars.length);
    return true;
};

// 修改可用性检查函数，排除当前订单
function isCarAvailable(vin, startDate, endDate, excludeOrderId = null) {
    const orders = getOrders();

    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);

    const conflicts = orders.filter(order => {
        // 排除当前订单
        if (excludeOrderId && order.id === excludeOrderId) {
            return false;
        }

        // 🎯 关键修改：排除草稿状态和已取消的订单
        if (order.vin !== vin || order.status === 'cancelled' || order.status === 'draft') {
            return false;
        }

        const existingStart = new Date(order.rentalPeriod.startDate);
        const existingEnd = new Date(existingStart);
        existingEnd.setDate(existingEnd.getDate() + order.rentalPeriod.days);

        // 检查日期重叠
        return (requestStart < existingEnd && requestEnd > existingStart);
    });

    return conflicts.length === 0;
}

// 替换现有的 checkCarAvailabilityForFuture 函数
function checkCarAvailabilityForFuture(vin) {
    const orders = getOrders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureConfirmedOrders = orders.filter(order => {
        if (order.vin !== vin || order.status !== 'confirmed') {
            return false;
        }

        const orderStartDate = new Date(order.rentalPeriod.startDate);

        // 只检查今天及以后的订单
        return orderStartDate >= today;
    });

    // 如果有未来的确认订单，需要检查是否还有可用时间段
    return futureConfirmedOrders.length === 0;
}

// 新增：检查特定日期范围的可用性
function isCarAvailableForDateRange(vin, startDate, endDate) {
    const orders = getOrders();

    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);

    const conflicts = orders.filter(order => {
        // 只检查已确认的订单
        if (order.vin !== vin || order.status !== 'confirmed') {
            return false;
        }

        const existingStart = new Date(order.rentalPeriod.startDate);
        const existingEnd = new Date(existingStart);
        existingEnd.setDate(existingEnd.getDate() + order.rentalPeriod.days);

        // 检查日期重叠
        return (requestStart < existingEnd && requestEnd > existingStart);
    });

    return {
        available: conflicts.length === 0,
        conflicts: conflicts
    };
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

// 🎯 修复后的创建新订单端点
app.post('/api/orders', (req, res) => {
    try {
        console.log('Creating new reservation draft:', req.body);

        const { vin, customerInfo, rentalPeriod, totalPrice } = req.body;

        // 验证必填字段
        if (!vin || !customerInfo || !rentalPeriod || !totalPrice) {
            return res.status(400).json({
                success: false,
                message: 'Missing required order information'
            });
        }

        // 检查车辆可用性
        const startDate = new Date(rentalPeriod.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(rentalPeriod.days));

        if (!isCarAvailable(vin, startDate, endDate)) {
            return res.status(409).json({
                success: false,
                message: 'Sorry, this car is not available for the selected dates. Please choose different dates.'
            });
        }

        // 查找车辆详情
        const cars = getCars();
        const selectedCar = cars.find(car => car.vin === vin);

        if (!selectedCar) {
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        // 🎯 关键修改：创建草稿订单，不影响车辆可用性
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
            status: 'draft', // 🎯 新状态：草稿，表示未确认
            createdAt: new Date().toISOString()
        };

        // 保存订单到内存
        const orders = getOrders();
        orders.push(order);
        saveOrders(orders);

        console.log('✅ Draft order created successfully:', order.id);

        res.json({
            success: true,
            message: 'Reservation draft created successfully',
            order: order
        });

    } catch (error) {
        console.error('❌ 创建订单详细错误:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create reservation draft',
            error: error.message,
            stack: error.stack
        });
    }
});

// 确认订单端点
app.put('/api/orders/:id/confirm', (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('Confirming order:', orderId);

        const orders = getOrders();
        const orderIndex = orders.findIndex(order => order.id === orderId);

        if (orderIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const order = orders[orderIndex];

        // 检查订单状态
        if (order.status === 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'Order is already confirmed'
            });
        }

        // 检查订单是否过期（可选）
        const orderAge = Date.now() - new Date(order.createdAt).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24小时

        if (orderAge > maxAge) {
            return res.status(400).json({
                success: false,
                message: 'Order has expired. Please create a new reservation.'
            });
        }

        // 再次检查车辆可用性
        const startDate = new Date(order.rentalPeriod.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + order.rentalPeriod.days);

        const availabilityCheck = isCarAvailableForDateRange(order.vin, startDate, endDate);

        if (!availabilityCheck.available) {
            // 提供更详细的冲突信息
            const conflictInfo = availabilityCheck.conflicts.map(conflict => ({
                startDate: conflict.rentalPeriod.startDate,
                days: conflict.rentalPeriod.days,
                customer: conflict.customerInfo.name
            }));

            return res.status(409).json({
                success: false,
                message: 'Car is no longer available for these dates',
                conflicts: conflictInfo
            });
        }

        // 更新订单状态为已确认
        orders[orderIndex] = {
            ...order,
            status: 'confirmed',
            confirmedAt: new Date().toISOString()
        };

        // 保存订单到内存
        saveOrders(orders);

        // 更新车辆状态
        const cars = getCars();
        const carIndex = cars.findIndex(car => car.vin === order.vin);
        if (carIndex !== -1) {
            cars[carIndex] = {
                ...cars[carIndex],
                available: false
            };
            saveCars(cars);
        }

        console.log('✅ Order confirmed successfully:', {
            orderId: orderId,
            carVin: order.vin,
            carNowUnavailable: true
        });

        res.json({
            success: true,
            message: 'Order confirmed successfully',
            order: orders[orderIndex],
            carStatus: {
                vin: order.vin,
                available: false
            }
        });

    } catch (error) {
        console.error('Error confirming order:', error);
        res.status(500).json({
            success: false,
            message: 'Error confirming order',
            error: error.message
        });
    }
});

// 新增：取消草稿订单的端点
app.delete('/api/orders/:id/cancel', (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('Cancelling draft order:', orderId);

        const orders = getOrders();
        const orderIndex = orders.findIndex(order => order.id === orderId);

        if (orderIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const order = orders[orderIndex];

        // 只能取消草稿状态的订单
        if (order.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Can only cancel draft orders'
            });
        }

        // 删除草稿订单
        orders.splice(orderIndex, 1);
        saveOrders(orders);

        console.log('Draft order cancelled successfully:', orderId);

        res.json({
            success: true,
            message: 'Draft order cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling draft order:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling draft order'
        });
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

// 清理过期的草稿订单
function cleanupExpiredDraftOrders() {
    try {
        const orders = getOrders();
        const now = new Date();
        const expiredTime = 24 * 60 * 60 * 1000; // 24小时过期

        const validOrders = orders.filter(order => {
            // 保留已确认和待处理的订单
            if (order.status === 'confirmed' || order.status === 'pending') {
                return true;
            }

            // 清理超过24小时的草稿订单
            if (order.status === 'draft') {
                const orderTime = new Date(order.createdAt);
                const timeDiff = now - orderTime;
                return timeDiff < expiredTime;
            }

            return true;
        });

        // 如果有草稿订单被清理，保存更新
        if (validOrders.length !== orders.length) {
            saveOrders(validOrders);
            console.log(`Cleaned up ${orders.length - validOrders.length} expired draft orders`);
        }
    } catch (error) {
        console.error('Error cleaning up draft orders:', error);
    }
}

// 获取用户的草稿订单（可选功能）
app.get('/api/orders/drafts', (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email parameter is required'
            });
        }

        const orders = getOrders();
        const userDraftOrders = orders.filter(order =>
            order.status === 'draft' &&
            order.customerInfo.email.toLowerCase() === email.toLowerCase()
        );

        res.json({
            success: true,
            draftOrders: userDraftOrders
        });

    } catch (error) {
        console.error('Error fetching draft orders:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching draft orders'
        });
    }
});

// 添加健康检查端点
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dataStatus: {
            cars: getCars().length,
            orders: getOrders().length
        }
    });
});

// 🎯 初始化数据并启动服务器
initializeData();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Car Rental Server running on port ${PORT}`);
    console.log(`📊 Health check available at /health`);
    console.log(`📋 Loaded data: ${getCars().length} cars, ${getOrders().length} orders`);

    // 启动时清理一次
    cleanupExpiredDraftOrders();

    // 每小时清理一次过期的草稿订单
    setInterval(cleanupExpiredDraftOrders, 60 * 60 * 1000);
});