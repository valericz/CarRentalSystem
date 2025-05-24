// 全局变量
let allCars = [];
let filteredCars = [];
let selectedCarVin = localStorage.getItem('selectedCarVin') || null;

// 页面加载完成后执行
$(document).ready(function () {
    initializePage();
});

// 初始化页面
async function initializePage() {
    try {
        // 加载车辆数据
        await loadCars();

        // 加载筛选选项
        await loadFilters();

        // 显示所有车辆
        displayCars(allCars);

        // 绑定事件
        bindEvents();

    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Failed to load data. Please refresh the page.');
    }
}

// 加载车辆数据
async function loadCars(searchQuery = '', typeFilter = '', brandFilter = '') {
    showLoading();

    try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (typeFilter) params.append('type', typeFilter);
        if (brandFilter) params.append('brand', brandFilter);

        const response = await $.ajax({
            url: `/api/cars?${params.toString()}`,
            method: 'GET'
        });

        filteredCars = response;
        if (!searchQuery && !typeFilter && !brandFilter) {
            allCars = response;
        }

        hideLoading();
        return response;
    } catch (error) {
        hideLoading();
        throw error;
    }
}

// 加载筛选选项
async function loadFilters() {
    try {
        const response = await $.ajax({
            url: '/api/filters',
            method: 'GET'
        });

        // 填充类型筛选
        const typeSelect = $('#typeFilter');
        response.types.forEach(type => {
            typeSelect.append(`<option value="${type}">${type}</option>`);
        });

        // 填充品牌筛选
        const brandSelect = $('#brandFilter');
        response.brands.forEach(brand => {
            brandSelect.append(`<option value="${brand}">${brand}</option>`);
        });

    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

// 显示车辆网格 - 适配新版主页结构
function displayCars(cars) {
    const grid = $('#carsContainer');
    grid.empty();

    if (!cars.length) {
        grid.append(`
            <div class="col-12">
                <div class="alert alert-info text-center">
                    <i class="fas fa-search me-2"></i>
                    No cars found matching your criteria.
                </div>
            </div>
        `);
        return;
    }

    cars.forEach(car => {
        grid.append(createCarCard(car));
    });
}

// 创建车辆卡片 - 适配新版主页结构
function createCarCard(car) {
    const availabilityBadge = car.available
        ? '<span class="badge bg-success">Available</span>'
        : '<span class="badge bg-danger">Unavailable</span>';

    const rentButton = car.available
        ? `<a href="/reservation?carId=${car.vin}" class="btn btn-primary w-100 mt-2">
             <i class="fas fa-calendar-plus me-1"></i>Reserve Now
           </a>`
        : `<button class="btn btn-secondary w-100 mt-2" disabled>
             <i class="fas fa-times me-1"></i>Unavailable
           </button>`;

    const imageUrl = car.image || '/api/placeholder/300/200';

    return `
        <div class="col-md-4 mb-4">
            <div class="card h-100 shadow-sm car-card">
                <img src="${imageUrl}" class="card-img-top car-image" alt="${car.brand} ${car.model}" style="object-fit:cover;height:200px;">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title text-primary mb-0">${car.brand} ${car.model}</h5>
                        ${availabilityBadge}
                    </div>
                    <div class="car-details mb-3">
                        <p class="mb-1"><i class="fas fa-car me-2"></i><strong>Type:</strong> ${car.type}</p>
                        <p class="mb-1"><i class="fas fa-calendar me-2"></i><strong>Year:</strong> ${car.year}</p>
                        <p class="mb-1"><i class="fas fa-tachometer-alt me-2"></i><strong>Mileage:</strong> ${car.mileage.toLocaleString()} km</p>
                        <p class="mb-1"><i class="fas fa-gas-pump me-2"></i><strong>Fuel:</strong> ${car.fuelType}</p>
                        ${car.description ? `<p class="text-muted mb-2 small">${car.description}</p>` : ''}
                    </div>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="price">
                                <h4 class="text-primary mb-0">$${car.pricePerDay}/day</h4>
                            </div>
                        </div>
                        ${rentButton}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 绑定事件
function bindEvents() {
    // Logo点击返回首页
    $('#logo').on('click', function (e) {
        e.preventDefault();
        window.location.href = '/';
    });

    // 搜索输入框事件
    let searchTimeout;
    $('#searchInput').on('input', function () {
        clearTimeout(searchTimeout);
        const query = $(this).val().trim();

        if (query.length >= 2) {
            searchTimeout = setTimeout(() => loadSuggestions(query), 300);
        } else {
            hideSuggestions();
        }
    });

    // 搜索框回车事件
    $('#searchInput').on('keypress', function (e) {
        if (e.which === 13) { // Enter键
            e.preventDefault();
            performSearch();
        }
    });

    // 筛选器变化事件
    $('#typeFilter, #brandFilter').on('change', function () {
        performSearch();
    });

    // 租赁按钮点击事件
    $(document).on('click', '.rent-btn', function () {
        const vin = $(this).data('vin');
        selectCar(vin);
    });

    // 点击其他地方隐藏建议
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#searchInput, #searchSuggestions').length) {
            hideSuggestions();
        }
    });
}

// 创建骨架屏
function createSkeletonCard() {
    return `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="card h-100 shadow-sm skeleton-card">
                <div class="skeleton skeleton-image"></div>
                <div class="card-body">
                    <div class="skeleton skeleton-text long mb-3"></div>
                    <div class="skeleton skeleton-text short mb-2"></div>
                    <div class="skeleton skeleton-text mb-2"></div>
                    <div class="skeleton skeleton-text short mb-2"></div>
                    <div class="skeleton skeleton-text mb-2"></div>
                    <div class="mt-auto pt-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="skeleton skeleton-text short"></div>
                            <div class="skeleton skeleton-text short"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 显示骨架屏
function showSkeletonLoading(count = 6) {
    const grid = $('#carsGrid');
    let skeletonHtml = '';

    for (let i = 0; i < count; i++) {
        skeletonHtml += createSkeletonCard();
    }

    grid.html(skeletonHtml);
}

// 执行搜索 - 优化版
async function performSearch() {
    const searchQuery = $('#searchInput').val().trim();
    const typeFilter = $('#typeFilter').val();
    const brandFilter = $('#brandFilter').val();

    try {
        // 显示骨架屏而不是空白
        showSkeletonLoading();

        const cars = await loadCars(searchQuery, typeFilter, brandFilter);

        // 延迟一点点让用户看到加载效果
        setTimeout(() => {
            displayCars(cars);
            hideSuggestions();
        }, 200);

    } catch (error) {
        console.error('Search error:', error);
        showError('Search failed. Please try again.');
        // 出错时也要隐藏骨架屏
        displayCars([]);
    }
}

// 加载搜索建议
async function loadSuggestions(query) {
    try {
        const response = await $.ajax({
            url: `/api/suggestions?q=${encodeURIComponent(query)}`,
            method: 'GET'
        });

        displaySuggestions(response);
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

// 显示搜索建议
function displaySuggestions(suggestions) {
    const suggestionsContainer = $('#searchSuggestions');

    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }

    let html = '<div class="suggestions-list">';
    suggestions.forEach(suggestion => {
        html += `<div class="suggestion-item" data-suggestion="${suggestion}">
                    <i class="fas fa-search me-2"></i>${suggestion}
                 </div>`;
    });
    html += '</div>';

    suggestionsContainer.html(html).show();

    // 绑定建议点击事件
    $('.suggestion-item').on('click', function () {
        const suggestion = $(this).data('suggestion');
        $('#searchInput').val(suggestion);
        hideSuggestions();
        performSearch();
    });
}

// 隐藏搜索建议
function hideSuggestions() {
    $('#searchSuggestions').hide().empty();
}

// 选择车辆
function selectCar(vin) {
    // 保存选中的车辆VIN到localStorage
    localStorage.setItem('selectedCarVin', vin);
    selectedCarVin = vin;

    // 跳转到预订页面
    window.location.href = '/reservation.html';
}

// 显示加载状态 - 优化版
function showLoading() {
    // 不隐藏现有内容，而是添加加载遮罩
    const grid = $('#carsGrid');

    // 如果已经有加载遮罩，不重复添加
    if (grid.find('.loading-overlay').length > 0) return;

    const loadingOverlay = `
        <div class="loading-overlay position-absolute w-100 h-100 d-flex justify-content-center align-items-center" 
             style="background: rgba(248, 249, 250, 0.8); z-index: 10; top: 0; left: 0;">
            <div class="text-center">
                <div class="spinner-border text-primary mb-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted">Loading cars...</div>
            </div>
        </div>
    `;

    // 设置grid为相对定位以便遮罩定位
    grid.css('position', 'relative').append(loadingOverlay);

    $('#noResults').hide();
}

// 隐藏加载状态 - 优化版
function hideLoading() {
    $('#carsGrid .loading-overlay').fadeOut(200, function () {
        $(this).remove();
    });
}

// 显示错误信息
function showError(message) {
    const alertHtml = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    // 在页面顶部显示错误信息
    $('main .container').prepend(alertHtml);

    // 3秒后自动隐藏
    setTimeout(() => {
        $('.alert').alert('close');
    }, 3000);
}

// 工具函数：格式化价格
function formatPrice(price) {
    return `${parseFloat(price).toFixed(2)}`;
}

// 工具函数：格式化里程数
function formatMileage(mileage) {
    return parseInt(mileage).toLocaleString() + ' miles';
}

// 工具函数：获取车辆可用性文本
function getAvailabilityText(available) {
    return available ? 'Available' : 'Not Available';
}

// 工具函数：获取车辆可用性CSS类
function getAvailabilityClass(available) {
    return available ? 'text-success' : 'text-danger';
}

// 页面卸载时保存搜索状态（可选功能）
$(window).on('beforeunload', function () {
    const searchState = {
        query: $('#searchInput').val(),
        typeFilter: $('#typeFilter').val(),
        brandFilter: $('#brandFilter').val()
    };
    sessionStorage.setItem('searchState', JSON.stringify(searchState));
});

// 页面加载时恢复搜索状态（可选功能）
function restoreSearchState() {
    const savedState = sessionStorage.getItem('searchState');
    if (savedState) {
        try {
            const searchState = JSON.parse(savedState);
            $('#searchInput').val(searchState.query || '');
            $('#typeFilter').val(searchState.typeFilter || '');
            $('#brandFilter').val(searchState.brandFilter || '');
        } catch (error) {
            console.error('Error restoring search state:', error);
        }
    }
}

// 车辆卡片悬停效果
$(document).on('mouseenter', '.car-card', function () {
    $(this).addClass('shadow-lg').removeClass('shadow-sm');
});

$(document).on('mouseleave', '.car-card', function () {
    $(this).addClass('shadow-sm').removeClass('shadow-lg');
});

// 响应式处理 - 在小屏幕上调整布局
function handleResponsiveLayout() {
    if ($(window).width() < 768) {
        $('.car-details p').addClass('small');
    } else {
        $('.car-details p').removeClass('small');
    }
}

// 窗口大小变化时调整布局
$(window).on('resize', handleResponsiveLayout);

// 页面加载完成后调整布局
$(document).ready(function () {
    handleResponsiveLayout();
    // 可选：恢复搜索状态
    // restoreSearchState();
});