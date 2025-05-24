// 全局变量
let allCars = [];
let currentBrandFilter = '';
let currentTypeFilter = '';
let currentSearchQuery = '';
let searchDebounceTimer = null;

// 页面加载完成后执行
$(document).ready(function () {
    console.log('🚀 Initializing car rental app...');

    // 检查是否需要显示保存成功提示
    checkAndShowSaveSuccess();

    initializeFilters();
    loadCars();
});

// 检查并显示保存成功提示
function checkAndShowSaveSuccess() {
    if (localStorage.getItem('showSaveSuccess')) {
        const successHtml = `
            <div class="alert alert-success alert-dismissible fade show mb-4" role="alert">
                <i class="fas fa-check-circle me-2"></i>
                Your reservation details have been saved. You can complete the booking later.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        $('main .container').prepend(successHtml);

        // 清除标记
        localStorage.removeItem('showSaveSuccess');
    }
}

// 品牌筛选处理函数
function handleBrandFilter() {
    currentBrandFilter = $('#brandFilter').val();
    console.log('🔍 Brand filter selected:', currentBrandFilter);

    // 应用筛选
    applyFilters();
}

// 类型筛选处理函数
function handleTypeFilter() {
    currentTypeFilter = $('#typeFilter').val();
    console.log('🔍 Type filter selected:', currentTypeFilter);

    // 应用筛选
    applyFilters();
}

// 搜索处理函数 - 使用防抖
function handleSearch() {
    const query = $('#searchInput').val().trim();

    // 清除之前的定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    // 设置新的定时器
    searchDebounceTimer = setTimeout(() => {
        currentSearchQuery = query.toLowerCase();

        // 如果查询长度大于等于2，显示搜索建议
        if (query.length >= 2) {
            showSearchSuggestions(query);
        } else {
            hideSearchSuggestions();
            // 如果搜索框为空，显示所有车辆
            if (query.length === 0) {
                applyFilters();
            }
        }
    }, 300); // 300ms 防抖延迟
}

// 显示搜索建议
async function showSearchSuggestions(query) {
    try {
        // 获取搜索建议
        const suggestions = generateSearchSuggestions(query);

        // 如果没有建议，隐藏建议框
        if (suggestions.length === 0) {
            hideSearchSuggestions();
            return;
        }

        // 创建建议列表HTML
        const suggestionsHtml = suggestions.map(suggestion => `
            <div class="suggestion-item" data-value="${suggestion}">
                <i class="fas fa-search me-2"></i>
                ${highlightQuery(suggestion, query)}
            </div>
        `).join('');

        // 显示建议
        const $suggestions = $('#searchSuggestions');
        $suggestions.html(suggestionsHtml).show();

        // 绑定建议点击事件
        $('.suggestion-item').on('click', function () {
            const selectedValue = $(this).data('value');
            $('#searchInput').val(selectedValue);
            hideSearchSuggestions();
            currentSearchQuery = selectedValue.toLowerCase();
            applyFilters();
        });

    } catch (error) {
        console.error('Error showing search suggestions:', error);
        hideSearchSuggestions();
    }
}

// 生成搜索建议
function generateSearchSuggestions(query) {
    const queryLower = query.toLowerCase();
    const suggestions = new Set();

    // 从现有车辆数据中生成建议
    allCars.forEach(car => {
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

    // 转换为数组并限制数量
    return Array.from(suggestions).slice(0, 5);
}

// 隐藏搜索建议
function hideSearchSuggestions() {
    $('#searchSuggestions').hide().empty();
}

// 高亮搜索查询
function highlightQuery(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

// 应用所有筛选器
function applyFilters() {
    console.log('📊 Applying filters - Brand:', currentBrandFilter, 'Type:', currentTypeFilter, 'Search:', currentSearchQuery);

    // 如果没有任何筛选条件，直接显示所有车辆
    if (!currentBrandFilter && !currentTypeFilter && !currentSearchQuery) {
        displayCars(allCars);
        updateResultsCount(allCars.length, allCars.length);
        return;
    }

    let filteredCars = allCars.filter(car => {
        // 检查品牌筛选
        if (currentBrandFilter && car.brand !== currentBrandFilter) {
            return false;
        }

        // 检查类型筛选
        if (currentTypeFilter && car.type !== currentTypeFilter) {
            return false;
        }

        // 检查搜索筛选
        if (currentSearchQuery) {
            const searchFields = [
                car.brand,
                car.model,
                car.type,
                car.description || ''
            ].join(' ').toLowerCase();

            if (!searchFields.includes(currentSearchQuery)) {
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
    // 获取所有唯一品牌
    const brands = [...new Set(cars.map(car => car.brand))].sort();
    console.log('🏷️ Available brands:', brands);

    let brandOptions = '<option value="">All Brands</option>';
    brands.forEach(brand => {
        brandOptions += `<option value="${brand}">${brand}</option>`;
    });

    $('#brandFilter').html(brandOptions);
}

// 填充类型筛选器
function populateTypeFilter(cars) {
    // 获取所有唯一类型
    const types = [...new Set(cars.map(car => car.type))].sort();
    console.log('🏷️ Available types:', types);

    let typeOptions = '<option value="">All Types</option>';
    types.forEach(type => {
        typeOptions += `<option value="${type}">${type}</option>`;
    });

    $('#typeFilter').html(typeOptions);
}

// 清除筛选器
function clearFilters() {
    // 清除定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    currentBrandFilter = '';
    currentTypeFilter = '';
    currentSearchQuery = '';

    $('#brandFilter').val('');
    $('#typeFilter').val('');
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
            populateTypeFilter(cars);
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
    $('#typeFilter').off('change').on('change', handleTypeFilter);
    $('#searchInput').off('input').on('input', handleSearch);

    // 添加搜索框失焦事件，延迟隐藏建议框
    $('#searchInput').on('blur', function () {
        setTimeout(hideSearchSuggestions, 200);
    });

    // 添加搜索框键盘事件
    $('#searchInput').on('keydown', function (e) {
        const $suggestions = $('.suggestion-item');
        let $selected = $('.suggestion-item.selected');
        let index = $suggestions.index($selected);

        switch (e.keyCode) {
            case 40: // 下箭头
                e.preventDefault();
                if (index < $suggestions.length - 1) {
                    if ($selected.length) {
                        $selected.removeClass('selected');
                        $selected = $suggestions.eq(index + 1).addClass('selected');
                    } else {
                        $suggestions.first().addClass('selected');
                    }
                }
                break;

            case 38: // 上箭头
                e.preventDefault();
                if (index > 0) {
                    $selected.removeClass('selected');
                    $selected = $suggestions.eq(index - 1).addClass('selected');
                }
                break;

            case 13: // 回车
                e.preventDefault();
                if ($selected.length) {
                    const selectedValue = $selected.data('value');
                    $('#searchInput').val(selectedValue);
                    hideSearchSuggestions();
                    currentSearchQuery = selectedValue.toLowerCase();
                    applyFilters();
                } else {
                    applyFilters();
                }
                break;

            case 27: // ESC
                hideSearchSuggestions();
                break;
        }
    });

    console.log('✅ Filters initialized');
}

// 调试函数 - 在控制台使用
window.debugFilters = function () {
    console.log('🔍 Current filters:', {
        brand: currentBrandFilter,
        type: currentTypeFilter,
        search: currentSearchQuery,
        totalCars: allCars.length
    });

    console.log('🏷️ Available brands:', [...new Set(allCars.map(car => car.brand))]);

    return {
        allCars: allCars,
        currentFilters: { brand: currentBrandFilter, type: currentTypeFilter, search: currentSearchQuery }
    };
};