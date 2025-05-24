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

        return response;
    } catch (error) {
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
        typeSelect.empty().append('<option value="">All Types</option>');
        response.types.forEach(type => {
            typeSelect.append(`<option value="${type}">${type}</option>`);
        });

        // 填充品牌筛选
        const brandSelect = $('#brandFilter');
        brandSelect.empty().append('<option value="">All Brands</option>');
        response.brands.forEach(brand => {
            brandSelect.append(`<option value="${brand}">${brand}</option>`);
        });

    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

// 显示车辆网格
function displayCars(cars) {
    const grid = $('#carsContainer');
    grid.empty();

    if (!cars.length) {
        grid.append(`
            <div class="col-12">
                <div class="alert alert-info text-center">
                    <i class="fas fa-search me-2"></i>
                    No cars found matching your criteria.
                    <div class="mt-2">
                        <button class="btn btn-outline-primary" onclick="resetAllFilters()">
                            <i class="fas fa-refresh me-1"></i>Show All Cars
                        </button>
                    </div>
                </div>
            </div>
        `);
        return;
    }

    cars.forEach(car => {
        grid.append(createCarCard(car));
    });
}

// 创建车辆卡片
function createCarCard(car) {
    const availabilityBadge = car.available
        ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Available</span>'
        : '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Unavailable</span>';

    const rentButton = car.available
        ? `<a href="/reservation?carId=${car.vin}" class="btn btn-primary w-100 mt-2 rent-btn">
             <i class="fas fa-calendar-plus me-1"></i>Reserve Now
           </a>`
        : `<button class="btn btn-secondary w-100 mt-2" disabled>
             <i class="fas fa-times me-1"></i>Unavailable
           </button>`;

    const imageUrl = car.image || '/api/placeholder/300/200';

    return `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="card h-100 shadow-sm car-card" data-vin="${car.vin}">
                <div class="position-relative">
                    <img src="${imageUrl}" class="card-img-top car-image" alt="${car.brand} ${car.model}" 
                         style="object-fit:cover;height:200px;" onerror="this.src='/api/placeholder/300/200'">
                    <div class="position-absolute top-0 end-0 m-2">
                        ${availabilityBadge}
                    </div>
                </div>
                <div class="card-body d-flex flex-column">
                    <div class="mb-2">
                        <h5 class="card-title text-primary mb-1">${car.brand} ${car.model}</h5>
                        <span class="badge bg-secondary">${car.type}</span>
                    </div>
                    <div class="car-details mb-3 flex-grow-1">
                        <div class="row text-sm">
                            <div class="col-6 mb-1">
                                <i class="fas fa-calendar me-1 text-primary"></i>
                                <small>${car.year}</small>
                            </div>
                            <div class="col-6 mb-1">
                                <i class="fas fa-tachometer-alt me-1 text-primary"></i>
                                <small>${car.mileage.toLocaleString()}mi</small>
                            </div>
                            <div class="col-6 mb-1">
                                <i class="fas fa-gas-pump me-1 text-primary"></i>
                                <small>${car.fuelType}</small>
                            </div>
                            <div class="col-6 mb-1">
                                <i class="fas fa-users me-1 text-primary"></i>
                                <small>${car.passengerCapacity || 4} seats</small>
                            </div>
                        </div>
                        ${car.description ? `<p class="text-muted mt-2 mb-0 small">${car.description}</p>` : ''}
                    </div>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div class="price">
                                <h4 class="text-success mb-0">$${car.pricePerDay}<small class="text-muted">/day</small></h4>
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

    // 搜索按钮点击
    $('#searchButton').on('click', performSearch);

    // 搜索输入框事件
    let searchTimeout;
    $('#searchInput').on('input', function () {
        clearTimeout(searchTimeout);
        const query = $(this).val().trim();

        if (query.length >= 1) {
            searchTimeout = setTimeout(() => loadSuggestions(query), 300);
        } else if (query.length === 0) {
            hideSuggestions();
            displayCars(allCars); // 显示所有车辆
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

    // 搜索框焦点事件
    $('#searchInput').on('focus', function () {
        const query = $(this).val().trim();
        if (query.length >= 2) {
            loadSuggestions(query);
        }
    });

    // 筛选器变化事件
    $('#typeFilter, #brandFilter').on('change', function () {
        performSearch();
    });

    // 清除筛选器按钮
    $('#clearFilters').on('click', function () {
        resetAllFilters();
    });

    // 点击其他地方隐藏建议
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#searchInput, #searchSuggestions').length) {
            hideSuggestions();
        }
    });

    // 车辆卡片悬停效果
    $(document).on('mouseenter', '.car-card', function () {
        $(this).addClass('shadow-lg').removeClass('shadow-sm');
    });

    $(document).on('mouseleave', '.car-card', function () {
        $(this).addClass('shadow-sm').removeClass('shadow-lg');
    });
}

// 执行搜索
async function performSearch() {
    const searchQuery = $('#searchInput').val().trim();
    const typeFilter = $('#typeFilter').val();
    const brandFilter = $('#brandFilter').val();

    try {
        const cars = await loadCars(searchQuery, typeFilter, brandFilter);
        displayCars(cars);
        hideSuggestions();
    } catch (error) {
        console.error('Search error:', error);
        showError('Search failed. Please try again.');
        displayCars([]);
    }
}

// 重置所有筛选器
function resetAllFilters() {
    $('#searchInput').val('');
    $('#typeFilter').val('');
    $('#brandFilter').val('');
    hideSuggestions();
    displayCars(allCars);
}

// Enhanced search with loading states
function loadSuggestions(query) {
    // Show loading state
    showSearchLoading();

    const filteredCars = allCars.filter(car =>
        car.brand.toLowerCase().includes(query.toLowerCase()) ||
        car.model.toLowerCase().includes(query.toLowerCase()) ||
        car.type.toLowerCase().includes(query.toLowerCase())
    );

    // Simulate API delay for better UX
    setTimeout(() => {
        displaySuggestions(filteredCars.slice(0, 5), query);
    }, 100);
}

// Show search loading state
function showSearchLoading() {
    const loadingHtml = `
        <div class="suggestion-item loading">
            <span class="spinner-border spinner-border-sm me-2"></span>
            Searching...
        </div>
    `;
    $('#suggestions').html(loadingHtml).show();
}

// Enhanced suggestions display
function displaySuggestions(cars, query) {
    if (cars.length === 0) {
        const noResultsHtml = `
            <div class="suggestion-item no-results">
                <i class="fas fa-search me-2"></i>
                No cars found for "${query}"
            </div>
        `;
        $('#suggestions').html(noResultsHtml).show();
        return;
    }

    let suggestionsHtml = '';
    cars.forEach(car => {
        const highlightedText = highlightSearchTerm(`${car.brand} ${car.model}`, query);
        suggestionsHtml += `
            <div class="suggestion-item" data-car-id="${car.vin}">
                <div class="d-flex align-items-center">
                    <img src="${car.image || '/api/placeholder/50/35'}" alt="${car.brand} ${car.model}" class="suggestion-image me-3">
                    <div>
                        <div class="suggestion-title">${highlightedText}</div>
                        <div class="suggestion-details">
                            ${car.type} • $${car.pricePerDay}/day • ${car.available ? 'Available' : 'Unavailable'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    $('#suggestions').html(suggestionsHtml).show();
}

// Highlight search terms
function highlightSearchTerm(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Enhanced car display with loading states
function displayCars(cars) {
    if (cars.length === 0) {
        showNoResults();
        return;
    }

    let carsHtml = '';
    cars.forEach(car => {
        const statusBadge = car.available
            ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Available</span>'
            : '<span class="badge bg-warning"><i class="fas fa-clock me-1"></i>Unavailable</span>';

        carsHtml += `
            <div class="col-lg-4 col-md-6 mb-4" data-car-id="${car.vin}">
                <div class="card car-card h-100 ${car.available ? '' : 'unavailable'}">
                    <div class="position-relative">
                        <img src="${car.image || '/api/placeholder/300/200'}" class="card-img-top car-image" 
                             alt="${car.brand} ${car.model}"
                             style="object-fit:cover;height:200px;"
                             onerror="this.src='/api/placeholder/300/200'">
                        <div class="position-absolute top-0 end-0 m-2">
                            ${statusBadge}
                        </div>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-primary">${car.brand} ${car.model}</h5>
                        <div class="car-details mb-3">
                            <div class="row text-sm">
                                <div class="col-6 mb-1">
                                    <i class="fas fa-car text-primary me-2"></i>${car.type}
                                </div>
                                <div class="col-6 mb-1">
                                    <i class="fas fa-calendar-alt text-primary me-2"></i>${car.year}
                                </div>
                                <div class="col-6 mb-1">
                                    <i class="fas fa-tachometer-alt text-primary me-2"></i>${car.mileage.toLocaleString()}mi
                                </div>
                                <div class="col-6 mb-1">
                                    <i class="fas fa-gas-pump text-primary me-2"></i>${car.fuelType}
                                </div>
                            </div>
                        </div>
                        <div class="mt-auto">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h4 class="text-success mb-0">$${car.pricePerDay}<small class="text-muted">/day</small></h4>
                            </div>
                            <a href="/reservation?carId=${car.vin}" 
                               class="btn btn-primary w-100 rent-btn"
                               ${car.available ? '' : 'disabled'}>
                                ${car.available ? '<i class="fas fa-calendar-plus me-1"></i>Rent Now' : '<i class="fas fa-times me-1"></i>Unavailable'}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    $('#carsContainer').html(carsHtml);
    updateResultsCount(cars.length);
}

// Show no results message
function showNoResults() {
    const noResultsHtml = `
        <div class="col-12">
            <div class="text-center py-5">
                <i class="fas fa-car text-muted" style="font-size: 4rem;"></i>
                <h4 class="mt-3 text-muted">No Cars Found</h4>
                <p class="text-muted">Try adjusting your search criteria</p>
                <button class="btn btn-outline-primary" onclick="clearSearch()">
                    <i class="fas fa-undo me-2"></i>Show All Cars
                </button>
            </div>
        </div>
    `;
    $('#carsContainer').html(noResultsHtml);
    updateResultsCount(0);
}

// Update results count
function updateResultsCount(count) {
    const text = count === 1 ? '1 car found' : `${count} cars found`;
    $('#resultsCount').text(text);
}

// Clear search function
function clearSearch() {
    $('#searchInput').val('');
    $('#typeFilter').val('');
    $('#brandFilter').val('');
    hideSuggestions();
    displayCars(allCars);
}

// Add CSS for enhanced search
const searchStyles = `
<style>
.suggestion-item {
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background-color 0.2s;
}

.suggestion-item:hover {
    background-color: #f8f9fa;
}

.suggestion-item.loading {
    cursor: default;
    color: #6c757d;
}

.suggestion-item.no-results {
    cursor: default;
    color: #6c757d;
    font-style: italic;
}

.suggestion-image {
    width: 50px;
    height: 35px;
    object-fit: cover;
    border-radius: 4px;
}

.suggestion-title {
    font-weight: 600;
    color: #333;
}

.suggestion-details {
    font-size: 0.85em;
    color: #6c757d;
}

.car-card.unavailable {
    opacity: 0.8;
}

.car-card.unavailable .card-img-top {
    filter: grayscale(50%);
}

mark {
    background-color: #fff3cd;
    padding: 0 2px;
    border-radius: 2px;
}

#resultsCount {
    color: #6c757d;
    font-size: 0.9em;
    margin-bottom: 1rem;
}

#suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
}
</style>
`;

// Inject styles
if (!document.getElementById('searchStyles')) {
    $('head').append(searchStyles);
    $('<div id="searchStyles">').appendTo('head');
}

// Hide suggestions
function hideSuggestions() {
    $('#suggestions').hide();
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

    // 滚动到顶部
    $('html, body').animate({ scrollTop: 0 }, 300);

    // 5秒后自动隐藏
    setTimeout(() => {
        $('.alert').alert('close');
    }, 5000);
}

// 键盘导航支持
let selectedSuggestionIndex = -1;

$(document).on('keydown', '#searchInput', function (e) {
    const suggestions = $('.suggestion-item');

    switch (e.keyCode) {
        case 40: // 下箭头
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
            updateSelectedSuggestion(suggestions);
            break;
        case 38: // 上箭头
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSelectedSuggestion(suggestions);
            break;
        case 13: // Enter键
            if (selectedSuggestionIndex >= 0 && suggestions.length > 0) {
                e.preventDefault();
                const selectedSuggestion = $(suggestions[selectedSuggestionIndex]).data('suggestion');
                $('#searchInput').val(selectedSuggestion);
                hideSuggestions();
                performSearch();
                selectedSuggestionIndex = -1;
            }
            break;
        case 27: // Escape键
            hideSuggestions();
            selectedSuggestionIndex = -1;
            break;
    }
});

// 更新选中的建议项
function updateSelectedSuggestion(suggestions) {
    suggestions.removeClass('selected');
    if (selectedSuggestionIndex >= 0) {
        $(suggestions[selectedSuggestionIndex]).addClass('selected');
    }
}

// 响应式处理
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
});