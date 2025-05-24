// 搜索相关的专门功能文件
// 这个文件主要处理搜索建议和高级搜索功能

// 搜索建议缓存
let suggestionsCache = new Map();
let searchDebounceTimer = null;

// 初始化搜索功能
function initializeSearch() {
    setupSearchEventHandlers();
    setupKeyboardNavigation();
}

// 设置搜索事件处理器
function setupSearchEventHandlers() {
    const searchInput = $('#searchInput');

    // 输入事件 - 实时搜索建议
    searchInput.on('input', function () {
        const query = $(this).val().trim();

        // 清除之前的定时器
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }

        // 设置新的防抖定时器
        searchDebounceTimer = setTimeout(() => {
            if (query.length >= 2) {
                loadSearchSuggestions(query);
            } else if (query.length === 0) {
                hideSuggestions();
                // 如果搜索框为空，显示所有车辆
                displayCars(allCars);
            } else {
                hideSuggestions();
            }
        }, 300); // 300ms防抖
    });

    // 焦点事件
    searchInput.on('focus', function () {
        const query = $(this).val().trim();
        if (query.length >= 2) {
            loadSearchSuggestions(query);
        }
    });

    // 失去焦点事件（延迟隐藏建议，允许点击建议）
    searchInput.on('blur', function () {
        setTimeout(() => {
            hideSuggestions();
        }, 200);
    });
}

// 设置键盘导航
function setupKeyboardNavigation() {
    let selectedIndex = -1;

    $('#searchInput').on('keydown', function (e) {
        const suggestions = $('.suggestion-item');

        switch (e.keyCode) {
            case 40: // 下箭头
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                updateSelectedSuggestion(suggestions, selectedIndex);
                break;

            case 38: // 上箭头
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelectedSuggestion(suggestions, selectedIndex);
                break;

            case 13: // Enter键
                e.preventDefault();
                if (selectedIndex >= 0 && suggestions.length > 0) {
                    // 选择建议
                    const selectedSuggestion = $(suggestions[selectedIndex]).data('suggestion');
                    $('#searchInput').val(selectedSuggestion);
                    hideSuggestions();
                    performSearch();
                } else {
                    // 直接搜索
                    performSearch();
                }
                selectedIndex = -1;
                break;

            case 27: // Escape键
                hideSuggestions();
                selectedIndex = -1;
                break;
        }
    });

    // 重置选中索引当建议改变时
    $(document).on('suggestionsUpdated', function () {
        selectedIndex = -1;
    });
}

// 更新选中的建议项
function updateSelectedSuggestion(suggestions, index) {
    suggestions.removeClass('selected');
    if (index >= 0) {
        $(suggestions[index]).addClass('selected');
    }
}

// 加载搜索建议（带缓存）
async function loadSearchSuggestions(query) {
    const cacheKey = query.toLowerCase();

    // 检查缓存
    if (suggestionsCache.has(cacheKey)) {
        displaySuggestions(suggestionsCache.get(cacheKey));
        return;
    }

    try {
        const response = await $.ajax({
            url: `/api/suggestions?q=${encodeURIComponent(query)}`,
            method: 'GET',
            timeout: 5000 // 5秒超时
        });

        // 缓存结果
        suggestionsCache.set(cacheKey, response);

        // 限制缓存大小
        if (suggestionsCache.size > 50) {
            const firstKey = suggestionsCache.keys().next().value;
            suggestionsCache.delete(firstKey);
        }

        displaySuggestions(response);
    } catch (error) {
        console.error('Error loading search suggestions:', error);
        // 搜索建议失败时不显示错误，静默处理
    }
}

// 高级搜索功能
function performAdvancedSearch() {
    const searchQuery = $('#searchInput').val().trim();
    const typeFilter = $('#typeFilter').val();
    const brandFilter = $('#brandFilter').val();

    // 构建搜索参数
    const searchParams = {
        query: searchQuery,
        type: typeFilter,
        brand: brandFilter
    };

    // 保存搜索历史
    saveSearchHistory(searchParams);

    // 执行搜索
    return performSearch();
}

// 保存搜索历史
function saveSearchHistory(searchParams) {
    let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');

    // 避免重复
    searchHistory = searchHistory.filter(item =>
        JSON.stringify(item) !== JSON.stringify(searchParams)
    );

    // 添加到开头
    searchHistory.unshift(searchParams);

    // 限制历史记录数量
    if (searchHistory.length > 10) {
        searchHistory = searchHistory.slice(0, 10);
    }

    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

// 获取搜索历史
function getSearchHistory() {
    return JSON.parse(localStorage.getItem('searchHistory') || '[]');
}

// 清除搜索历史
function clearSearchHistory() {
    localStorage.removeItem('searchHistory');
    suggestionsCache.clear();
}

// 智能搜索建议（包括搜索历史）
function getSmartSuggestions(query) {
    const history = getSearchHistory();
    const suggestions = [];

    // 添加历史搜索建议
    history.forEach(item => {
        if (item.query && item.query.toLowerCase().includes(query.toLowerCase())) {
            suggestions.push({
                text: item.query,
                type: 'history',
                icon: 'fas fa-history'
            });
        }
    });

    return suggestions;
}

// 搜索结果高亮
function highlightSearchTerms(text, searchTerm) {
    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// 搜索统计
function updateSearchStats(query, resultCount) {
    // 可以用于分析用户搜索行为
    const stats = {
        query: query,
        resultCount: resultCount,
        timestamp: new Date().toISOString()
    };

    // 保存到本地存储或发送到服务器
    console.log('Search stats:', stats);
}

// 搜索过滤器重置
function resetSearchFilters() {
    $('#searchInput').val('');
    $('#typeFilter').val('');
    $('#brandFilter').val('');
    hideSuggestions();
    displayCars(allCars);
}

// 导出函数供其他文件使用
window.searchUtils = {
    initializeSearch,
    performAdvancedSearch,
    resetSearchFilters,
    clearSearchHistory,
    getSearchHistory
};

// 页面加载时初始化
$(document).ready(function () {
    if (typeof initializeSearch === 'function') {
        initializeSearch();
    }
});

// Attach event listeners only after DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    // Debounced version for input
    const debouncedSearch = debounce(performSearch, 300);

    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('input', debouncedSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
});

// Debounce function
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    try {
        const response = await fetch('/api/cars');
        const data = await response.json();
        // data is an array of cars
        const filteredCars = data.filter(car => {
            return (
                car.brand.toLowerCase().includes(searchTerm) ||
                car.model.toLowerCase().includes(searchTerm) ||
                car.type.toLowerCase().includes(searchTerm) ||
                (car.description && car.description.toLowerCase().includes(searchTerm))
            );
        });
        displayCars(filteredCars);
    } catch (error) {
        console.error('Error searching cars:', error);
    }
}