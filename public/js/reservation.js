// 预订页面JavaScript逻辑
let selectedCar = null;
let reservationForm = null;
let savedFormData = {};

// 页面加载完成后执行
$(document).ready(function () {
    initializeReservationPage();
});

// 获取 URL 参数
function getCarIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('carId');
}

// 初始化预订页面
async function initializeReservationPage() {
    try {
        // 优先从 URL 获取 carId
        let selectedVin = getCarIdFromUrl();

        // 如果 URL 没有，再从 localStorage 获取
        if (!selectedVin) {
            selectedVin = localStorage.getItem('selectedCarVin');
        } else {
            // 如果 URL 有，顺便存到 localStorage，方便后续页面使用
            localStorage.setItem('selectedCarVin', selectedVin);
        }

        if (!selectedVin) {
            showNoCarSelected();
            return;
        }

        // 加载车辆信息
        await loadSelectedCar(selectedVin);

        // 初始化表单
        initializeForm();

        // 绑定事件
        bindReservationEvents();

    } catch (error) {
        console.error('Error initializing reservation page:', error);
        showError('Failed to load car information. Please try again.');
    }
}

// 显示未选择车辆的提示
function showNoCarSelected() {
    $('#noCarSelected').show();
    $('#reservationContent').hide();
}

// 加载选中的车辆信息
async function loadSelectedCar(vin) {
    try {
        const response = await $.ajax({
            url: `/api/cars/${vin}`,
            method: 'GET'
        });

        selectedCar = response;
        displayCarDetails(selectedCar);

        // 检查车辆可用性
        if (selectedCar.available) {
            showReservationForm();
        } else {
            showCarUnavailable();
        }

        $('#reservationContent').show();

    } catch (error) {
        console.error('Error loading car details:', error);
        showError('Car not found or no longer available.');
        throw error;
    }
}

// 显示车辆详情
function displayCarDetails(car) {
    const carDetailsHtml = `
        <div class="row">
            <div class="col-md-6">
                <img src="${car.image || '/api/placeholder/400/300'}" 
                     class="img-fluid rounded mb-3" 
                     alt="${car.brand} ${car.model}">
            </div>
            <div class="col-md-6">
                <h3 class="text-primary">${car.brand} ${car.model}</h3>
                <div class="car-info mt-3">
                    <div class="info-item mb-2">
                        <i class="fas fa-car text-primary me-2"></i>
                        <strong>Type:</strong> ${car.type}
                    </div>
                    <div class="info-item mb-2">
                        <i class="fas fa-calendar text-primary me-2"></i>
                        <strong>Year:</strong> ${car.year}
                    </div>
                    <div class="info-item mb-2">
                        <i class="fas fa-tachometer-alt text-primary me-2"></i>
                        <strong>Mileage:</strong> ${car.mileage.toLocaleString()} miles
                    </div>
                    <div class="info-item mb-2">
                        <i class="fas fa-gas-pump text-primary me-2"></i>
                        <strong>Fuel Type:</strong> ${car.fuelType}
                    </div>
                    <div class="info-item mb-2">
                        <i class="fas fa-dollar-sign text-primary me-2"></i>
                        <strong>Price per Day:</strong> $${car.pricePerDay}
                    </div>
                    <div class="info-item mb-2">
                        <i class="fas fa-info-circle text-primary me-2"></i>
                        <strong>Status:</strong> 
                        <span class="badge ${car.available ? 'bg-success' : 'bg-danger'}">
                            ${car.available ? 'Available' : 'Unavailable'}
                        </span>
                    </div>
                    ${car.description ? `
                        <div class="info-item mt-3">
                            <i class="fas fa-file-text text-primary me-2"></i>
                            <strong>Description:</strong>
                            <p class="mt-1 text-muted">${car.description}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    $('#carDetails').html(carDetailsHtml);
}

// 显示预订表单
function showReservationForm() {
    $('#carUnavailable').hide();
    $('#reservationForm').show();
    loadSavedFormData();
}

// 显示车辆不可用信息
function showCarUnavailable() {
    $('#reservationForm').hide();
    $('#carUnavailable').show();
}

// 初始化表单
function initializeForm() {
    reservationForm = $('#reservationForm');

    // 设置最小日期为今天
    const today = new Date().toISOString().split('T')[0];
    $('#startDate').attr('min', today);

    // 设置默认开始日期为明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    $('#startDate').val(tomorrow.toISOString().split('T')[0]);
}

// 绑定预订页面事件
function bindReservationEvents() {
    // 表单输入实时验证
    $('#reservationForm input, #reservationForm select').on('input change', function () {
        validateField($(this));
        calculateTotalPrice();
        updateSubmitButtonState();
    });

    // 取消按钮
    $('#cancelBtn').on('click', function () {
        if (confirm('Are you sure you want to cancel? All entered information will be lost.')) {
            clearFormData();
            window.location.href = '/';
        }
    });

    // 表单提交 - 修复后直接提交到API
    $('#reservationForm').on('submit', function (e) {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        // 直接调用提交函数，不显示旧的确认框
        submitReservationDirectly();
    });

    // 表单数据自动保存
    $('#reservationForm input').on('blur', function () {
        saveFormData();
    });

    // 页面离开时保存表单数据
    $(window).on('beforeunload', function () {
        saveFormData();
    });
}

// 验证单个字段
function validateField($field) {
    const fieldId = $field.attr('id');
    const value = $field.val().trim();
    let isValid = true;
    let errorMessage = '';

    // 清除之前的验证状态
    $field.removeClass('is-valid is-invalid');

    switch (fieldId) {
        case 'customerName':
            if (!value) {
                isValid = false;
                errorMessage = 'Name is required.';
            } else if (value.length < 2) {
                isValid = false;
                errorMessage = 'Name must be at least 2 characters.';
            } else if (!/^[a-zA-Z\s'-]+$/.test(value)) {
                isValid = false;
                errorMessage = 'Name can only contain letters, spaces, hyphens, and apostrophes.';
            }
            break;

        case 'customerPhone':
            if (!value) {
                isValid = false;
                errorMessage = 'Phone number is required.';
            } else if (!/^\+?[\d\s\-\(\)]{10,}$/.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number.';
            }
            break;

        case 'customerEmail':
            if (!value) {
                isValid = false;
                errorMessage = 'Email is required.';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address.';
            }
            break;

        case 'driverLicense':
            if (!value) {
                isValid = false;
                errorMessage = 'Driver\'s license number is required.';
            } else if (value.length < 5) {
                isValid = false;
                errorMessage = 'Driver\'s license number is too short.';
            }
            break;

        case 'startDate':
            if (!value) {
                isValid = false;
                errorMessage = 'Start date is required.';
            } else {
                const selectedDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (selectedDate < today) {
                    isValid = false;
                    errorMessage = 'Start date cannot be in the past.';
                }
            }
            break;

        case 'rentalDays':
            if (!value) {
                isValid = false;
                errorMessage = 'Rental period is required.';
            } else {
                const days = parseInt(value);
                if (days < 1) {
                    isValid = false;
                    errorMessage = 'Rental period must be at least 1 day.';
                } else if (days > 30) {
                    isValid = false;
                    errorMessage = 'Rental period cannot exceed 30 days.';
                }
            }
            break;
    }

    // 应用验证结果
    if (isValid) {
        $field.addClass('is-valid');
    } else {
        $field.addClass('is-invalid');
    }

    // 显示错误消息
    const feedbackElement = $field.siblings('.invalid-feedback');
    feedbackElement.text(errorMessage);

    return isValid;
}

// 验证整个表单 - 修复后的版本
function validateForm() {
    let isValid = true;

    // 使用正确的字段ID
    const fields = {
        customerName: ($('#customerName').val() || '').trim(),
        customerEmail: ($('#customerEmail').val() || '').trim(),
        customerPhone: ($('#customerPhone').val() || '').trim(),
        driverLicense: ($('#driverLicense').val() || '').trim(),
        startDate: $('#startDate').val() || '',
        rentalDays: $('#rentalDays').val() || ''
    };

    console.log('Validating form fields:', fields);

    // 检查所有必填字段是否为空
    Object.keys(fields).forEach(key => {
        if (!fields[key]) {
            console.log(`${key} is empty`);
            isValid = false;
        }
    });

    // 特定字段验证
    if (fields.customerName && fields.customerName.length < 2) {
        console.log('Name too short');
        isValid = false;
    }

    if (fields.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.customerEmail)) {
        console.log('Email format invalid');
        isValid = false;
    }

    if (fields.customerPhone && fields.customerPhone.length < 10) {
        console.log('Phone too short');
        isValid = false;
    }

    if (fields.startDate) {
        const today = new Date().toISOString().split('T')[0];
        if (fields.startDate < today) {
            console.log('Start date is in the past');
            isValid = false;
        }
    }

    const days = parseInt(fields.rentalDays);
    if (fields.rentalDays && (!days || days < 1 || days > 30)) {
        console.log('Invalid rental days');
        isValid = false;
    }

    console.log('🎯 Validation result:', isValid);
    return isValid;
}

// 计算总价格
function calculateTotalPrice() {
    const days = parseInt($('#rentalDays').val()) || 0;
    const pricePerDay = selectedCar ? selectedCar.pricePerDay : 0;
    const totalPrice = days * pricePerDay;

    if (days > 0 && pricePerDay > 0) {
        $('#pricePerDay').text(`$${pricePerDay}`);
        $('#totalDays').text(days);
        $('#totalPrice').text(`$${totalPrice}`);
        $('#priceCalculation').show();
    } else {
        $('#priceCalculation').hide();
    }

    return totalPrice;
}

// 更新提交按钮状态
function updateSubmitButtonState() {
    const isFormValid = validateForm();
    $('#submitBtn').prop('disabled', !isFormValid);
}

// 直接提交预订 - 新的提交函数
async function submitReservationDirectly() {
    try {
        // 显示加载状态
        const $submitBtn = $('#submitBtn');
        $submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Creating Reservation...');

        const formData = getFormData();
        const reservationData = {
            vin: selectedCar.vin,
            customerInfo: {
                name: formData.customerName,
                email: formData.customerEmail,
                phone: formData.customerPhone,
                driverLicense: formData.driverLicense
            },
            rentalPeriod: {
                startDate: formData.startDate,
                days: parseInt(formData.rentalDays)
            },
            totalPrice: calculateTotalPrice()
        };

        console.log('Submitting reservation:', reservationData);

        // 提交到API
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reservationData)
        });

        const data = await response.json();
        console.log('Server response:', data);

        if (data.success) {
            // 使用新的确认流程
            handleOrderSubmissionSuccess(data);
        } else {
            throw new Error(data.message || 'Failed to create reservation');
        }

    } catch (error) {
        console.error('Error submitting reservation:', error);

        let errorMessage = 'Failed to submit reservation. Please try again.';

        if (error.response?.status === 400) {
            errorMessage = 'This car is no longer available. Please choose another car.';
        } else if (error.response?.status === 404) {
            errorMessage = 'Car not found. Please select another car.';
        } else if (error.response?.status === 500) {
            errorMessage = 'Server error. Please try again later.';
        }

        showError(errorMessage);

    } finally {
        // 恢复按钮状态
        $('#submitBtn').prop('disabled', false).html('Submit Reservation');
    }
}

// 显示订单确认模态框
function showOrderConfirmationModal(orderData) {
    // 填充模态框数据
    $('#modalOrderId').text('#' + orderData.id);
    $('#modalCarInfo').text((orderData.selectedCar?.brand || selectedCar.brand) + ' ' + (orderData.selectedCar?.model || selectedCar.model));
    $('#modalRentalPeriod').text(orderData.rentalPeriod.startDate + ' (' + orderData.rentalPeriod.days + ' days)');
    $('#modalTotalPrice').text('$' + orderData.totalPrice);

    $('#modalCustomerName').text(orderData.customerInfo.name);
    $('#modalCustomerEmail').text(orderData.customerInfo.email);
    $('#modalCustomerPhone').text(orderData.customerInfo.phone);

    // 存储订单ID用于确认
    $('#confirmOrderBtn').data('orderId', orderData.id);

    // 显示模态框
    $('#orderConfirmationModal').modal('show');
}

// 处理订单确认
$(document).on('click', '#confirmOrderBtn', function () {
    const orderId = $(this).data('orderId');
    const $btn = $(this);

    // 显示加载状态
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Confirming...');

    // 调用确认API
    fetch(`/api/orders/${orderId}/confirm`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 隐藏确认模态框
                $('#orderConfirmationModal').modal('hide');

                // 显示成功模态框
                setTimeout(() => {
                    $('#orderSuccessModal').modal('show');
                }, 500);

                console.log('Order confirmed successfully:', data);
            } else {
                throw new Error(data.message || 'Failed to confirm order');
            }
        })
        .catch(error => {
            console.error('Error confirming order:', error);
            alert('Failed to confirm order. Please try again.');
        })
        .finally(() => {
            // 重置按钮状态
            $btn.prop('disabled', false).html('✅ Confirm Order');
        });
});

// 处理订单提交成功
function handleOrderSubmissionSuccess(response) {
    if (response.success) {
        // 隐藏任何现存的模态框
        $('.modal').modal('hide');

        // 显示确认模态框而不是直接跳转
        showOrderConfirmationModal(response.order);
    } else {
        alert('Failed to create order: ' + (response.message || 'Unknown error'));
    }
}

// 获取表单数据
function getFormData() {
    return {
        customerName: $('#customerName').val().trim(),
        customerEmail: $('#customerEmail').val().trim(),
        customerPhone: $('#customerPhone').val().trim(),
        driverLicense: $('#driverLicense').val().trim(),
        startDate: $('#startDate').val(),
        rentalDays: $('#rentalDays').val()
    };
}

// 保存表单数据到本地存储
function saveFormData() {
    const formData = getFormData();
    localStorage.setItem('reservationFormData', JSON.stringify(formData));
}

// 加载已保存的表单数据
function loadSavedFormData() {
    const savedData = localStorage.getItem('reservationFormData');
    if (savedData) {
        try {
            const formData = JSON.parse(savedData);
            $('#customerName').val(formData.customerName || '');
            $('#customerEmail').val(formData.customerEmail || '');
            $('#customerPhone').val(formData.customerPhone || '');
            $('#driverLicense').val(formData.driverLicense || '');
            $('#startDate').val(formData.startDate || '');
            $('#rentalDays').val(formData.rentalDays || '');

            // 触发验证和价格计算
            $('#reservationForm input').each(function () {
                validateField($(this));
            });
            calculateTotalPrice();
            updateSubmitButtonState();
        } catch (error) {
            console.error('Error loading saved form data:', error);
        }
    }
}

// 清除表单数据
function clearFormData() {
    localStorage.removeItem('reservationFormData');
    $('#reservationForm')[0].reset();
    $('#reservationForm input').removeClass('is-valid is-invalid');
    $('#priceCalculation').hide();
    $('#submitBtn').prop('disabled', true);
}

// 清除选中的车辆
function clearSelectedCar() {
    localStorage.removeItem('selectedCarVin');
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

    $('main .container').prepend(alertHtml);

    // 滚动到顶部显示错误
    $('html, body').animate({ scrollTop: 0 }, 500);
}

// 显示验证错误
function showValidationErrors(errors) {
    let errorHtml = '<div class="alert alert-danger"><ul class="mb-0">';
    errors.forEach(error => {
        errorHtml += `<li>${error}</li>`;
    });
    errorHtml += '</ul></div>';

    $('#validationErrors').html(errorHtml).show();
}

// 隐藏验证错误
function hideValidationErrors() {
    $('#validationErrors').hide();
}

// 工具函数：格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}