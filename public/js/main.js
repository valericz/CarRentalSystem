// 全局变量
let allCars = [];
let currentBrandFilter = '';
let currentSearchQuery = '';
let searchDebounceTimer = null;

// 页面加载完成后执行
$(document).ready(function () {
    console.log('🚀 Initializing car rental app...');

    initializeFilters();
    loadCars();
});

// 品牌筛选处理函数
function handleBrandFilter() {
    currentBrandFilter = $('#brandFilter').val();
    console.log('🔍 Brand filter selected:', currentBrandFilter);

    // 应用筛选
    applyFilters();
}

// 搜索处理函数 - 使用防抖
function handleSearch() {
    // 清除之前的定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    // 设置新的定时器
    searchDebounceTimer = setTimeout(() => {
        currentSearchQuery = $('#searchInput').val().trim().toLowerCase();
        console.log('🔍 Search query:', currentSearchQuery);
        applyFilters();
    }, 300); // 300ms 防抖延迟
}

// 应用所有筛选器
function applyFilters() {
    console.log('📊 Applying filters - Brand:', currentBrandFilter, 'Search:', currentSearchQuery);

    // 如果没有任何筛选条件，直接显示所有车辆
    if (!currentBrandFilter && !currentSearchQuery) {
        displayCars(allCars);
        updateResultsCount(allCars.length, allCars.length);
        return;
    }

    let filteredCars = allCars.filter(car => {
        // 检查品牌筛选（支持 brand 或 make 字段）
        if (currentBrandFilter) {
            const carBrand = car.brand || car.make || '';
            if (carBrand !== currentBrandFilter) {
                console.log('❌ Brand mismatch:', carBrand, '!==', currentBrandFilter);
                return false;
            }
        }

        // 检查搜索筛选
        if (currentSearchQuery) {
            const searchFields = [
                car.brand || car.make || '',
                car.model || '',
                car.type || ''
            ].join(' ').toLowerCase();

            if (!searchFields.includes(currentSearchQuery)) {
                console.log('❌ Search mismatch for:', car.brand || car.make, car.model);
                return false;
            }
        }

        return true;
    });

    // 使用 requestAnimationFrame 优化渲染
    requestAnimationFrame(() => {
        displayCars(filteredCars);
        updateResultsCount(filteredCars.length, allCars.length);
    });
}

// 显示车辆
function displayCars(cars) {
    if (cars.length === 0) {
        showNoResults();
        return;
    }

    const grid = $('#carsContainer');
    grid.empty();

    cars.forEach(car => {
        // 使用 brand 或 make 字段
        const brandName = car.brand || car.make || 'Unknown';
        const statusBadge = car.available
            ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Available</span>'
            : '<span class="badge bg-danger"><i class="fas fa-ban me-1"></i>Unavailable</span>';

        // 创建默认占位图URL，使用车辆品牌和型号
        const placeholderText = `${brandName} ${car.model}`;
        const placeholderUrl = `/api/placeholder/800/500?text=${encodeURIComponent(placeholderText)}`;

        const carHtml = `
            <div class="col-lg-4 col-md-6 mb-4" data-car-id="${car.vin}">
                <div class="card car-card h-100 ${car.available ? '' : 'unavailable'}" 
                     style="${car.available ? '' : 'opacity: 0.7; cursor: not-allowed;'}">
                    <div class="position-relative" style="padding-top: 66.67%; background-color: #f8f9fa;">
                        <img src="${car.image || placeholderUrl}" 
                             class="card-img-top car-image position-absolute top-0 start-0 w-100 h-100" 
                             alt="${brandName} ${car.model}"
                             style="object-fit: cover; ${car.available ? '' : 'filter: grayscale(100%);'}"
                             onerror="this.src='${placeholderUrl}'; this.onerror=null;">
                        <div class="position-absolute top-0 end-0 m-2">
                            ${statusBadge}
                        </div>
                        ${!car.available ? `
                        <div class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                             style="background: rgba(0,0,0,0.5);">
                            <div class="text-white text-center p-3">
                                <i class="fas fa-ban fa-2x mb-2"></i>
                                <h5 class="mb-0">Currently Unavailable</h5>
                                <small>This vehicle cannot be rented at this time</small>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-truncate" title="${brandName} ${car.model}">${brandName} ${car.model}</h5>
                        <div class="car-details mb-3">
                            <p class="car-info mb-2"><i class="fas fa-car text-primary me-2"></i>Type: ${car.type}</p>
                            <p class="car-info mb-2"><i class="fas fa-calendar-alt text-primary me-2"></i>Year: ${car.year}</p>
                            <p class="car-info mb-2"><i class="fas fa-tachometer-alt text-primary me-2"></i>Mileage: ${car.mileage.toLocaleString()}</p>
                            <p class="car-info mb-2"><i class="fas fa-gas-pump text-primary me-2"></i>Fuel: ${car.fuelType}</p>
                        </div>
                        <div class="mt-auto">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <span class="price-text fw-bold">$${car.pricePerDay}/day</span>
                            </div>
                            ${car.available ? `
                                <a href="/reservation?carId=${car.vin}" 
                                   class="btn btn-primary w-100 rent-btn">
                                    <i class="fas fa-calendar-plus me-2"></i>Rent Now
                                </a>
                            ` : `
                                <button class="btn btn-secondary w-100" disabled>
                                    <i class="fas fa-ban me-2"></i>Unavailable
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

        grid.append(carHtml);
    });

    // 为不可用的车辆添加事件阻止
    $('.car-card.unavailable').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
}

// 显示无结果
function showNoResults() {
    const noResultsHtml = `
        <div class="col-12">
            <div class="text-center py-5">
                <i class="fas fa-car text-muted" style="font-size: 4rem;"></i>
                <h4 class="mt-3 text-muted">No Cars Found</h4>
                <p class="text-muted">No cars match your current filters</p>
                <button class="btn btn-outline-primary" onclick="clearFilters()">
                    <i class="fas fa-undo me-2"></i>Clear Filters
                </button>
            </div>
        </div>
    `;
    $('#carsContainer').html(noResultsHtml);
}

// 更新结果计数
function updateResultsCount(filtered, total) {
    const countText = filtered === total
        ? `${total} cars available`
        : `Showing ${filtered} of ${total} cars`;

    $('#resultsCount').text(countText);
}

// 填充品牌筛选器
function populateBrandFilter(cars) {
    // 获取所有唯一品牌（支持 brand 或 make 字段）
    const brands = [...new Set(cars.map(car => car.brand || car.make || 'Unknown'))].sort();

    console.log('🏷️ Available brands:', brands);

    let brandOptions = '<option value="">All Brands</option>';
    brands.forEach(brand => {
        brandOptions += `<option value="${brand}">${brand}</option>`;
    });

    $('#brandFilter').html(brandOptions);
}

// 清除筛选器
function clearFilters() {
    // 清除定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    currentBrandFilter = '';
    currentSearchQuery = '';

    $('#brandFilter').val('');
    $('#searchInput').val('');

    // 使用 requestAnimationFrame 优化渲染
    requestAnimationFrame(() => {
        displayCars(allCars);
        updateResultsCount(allCars.length, allCars.length);
    });

    console.log('🧹 Filters cleared');
}

// 加载车辆数据
async function loadCars() {
    try {
        console.log('🚗 Loading cars...');

        const response = await fetch('/api/cars');
        const cars = await response.json();

        allCars = cars;

        console.log('✅ Cars loaded:', cars.length);
        console.log('📋 Sample car data:', cars[0]);

        // 使用 requestAnimationFrame 优化初始渲染
        requestAnimationFrame(() => {
            populateBrandFilter(cars);
            displayCars(cars);
            updateResultsCount(cars.length, cars.length);
        });

    } catch (error) {
        console.error('❌ Error loading cars:', error);
        $('#carsContainer').html(`
            <div class="col-12">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load cars. Please refresh the page.
                </div>
            </div>
        `);
    }
}

// 初始化事件监听器
function initializeFilters() {
    console.log('🔧 Initializing filters...');

    // 移除可能存在的旧事件监听器
    $('#brandFilter').off('change').on('change', handleBrandFilter);
    $('#searchInput').off('input').on('input', handleSearch);

    console.log('✅ Filters initialized');
}

// 调试函数 - 在控制台使用
window.debugFilters = function () {
    console.log('🔍 Current filters:', {
        brand: currentBrandFilter,
        search: currentSearchQuery,
        totalCars: allCars.length
    });

    console.log('🏷️ Available brands:', [...new Set(allCars.map(car => car.brand || car.make))]);

    return {
        allCars: allCars,
        currentFilters: { brand: currentBrandFilter, search: currentSearchQuery }
    };
};