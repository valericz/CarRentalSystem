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

    // 表单提交
    $('#reservationForm').on('submit', function (e) {
        e.preventDefault();
        if (validateForm()) {
            showConfirmationModal();
        }
    });

    // 确认预订
    $('#confirmReservation').on('click', function () {
        submitReservation();
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

// 验证整个表单
function validateForm() {
    let isFormValid = true;

    // 验证所有必填字段
    $('#reservationForm input[required]').each(function () {
        if (!validateField($(this))) {
            isFormValid = false;
        }
    });

    return isFormValid;
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
    $('#submitBtn').prop('disabled', !isFormValid); // 只检查表单验证
}

// 显示确认模态框
function showConfirmationModal() {
    const formData = getFormData();
    const totalPrice = calculateTotalPrice();

    const confirmationHtml = `
        <div class="confirmation-details">
            <h6>Customer Information:</h6>
            <p><strong>Name:</strong> ${formData.customerName}</p>
            <p><strong>Email:</strong> ${formData.customerEmail}</p>
            <p><strong>Phone:</strong> ${formData.customerPhone}</p>
            
            <h6 class="mt-3">Rental Details:</h6>
            <p><strong>Car:</strong> ${selectedCar.brand} ${selectedCar.model}</p>
            <p><strong>Start Date:</strong> ${new Date(formData.startDate).toLocaleDateString()}</p>
            <p><strong>Rental Period:</strong> ${formData.rentalDays} days</p>
            <p><strong>Total Price:</strong> <span class="text-success fw-bold">$${totalPrice}</span></p>
        </div>
    `;

    $('#confirmationDetails').html(confirmationHtml);

    const modal = new bootstrap.Modal($('#confirmationModal')[0]);
    modal.show();
}

// 提交预订 - 增强版
async function submitReservation() {
    try {
        // 禁用确认按钮防止重复提交
        $('#confirmReservation').prop('disabled', true).html(
            '<span class="spinner-border spinner-border-sm me-1"></span>Processing...'
        );

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
            }
        };

        console.log('Submitting reservation:', reservationData);

        const response = await $.ajax({
            url: '/api/orders',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(reservationData),
            timeout: 10000 // 10秒超时
        });

        console.log('Server response:', response);

        if (response.success) {
            // 预订成功
            $('#confirmationModal').modal('hide');
            showReservationSuccess(response.order);
            clearFormData();
            clearSelectedCar();
        } else {
            throw new Error(response.error || 'Failed to create reservation');
        }

    } catch (error) {
        console.error('Error submitting reservation:', error);
        $('#confirmationModal').modal('hide');

        let errorMessage = 'Failed to submit reservation. Please try again.';

        if (error.status === 400) {
            errorMessage = 'This car is no longer available. Please choose another car.';
            // 3秒后跳转到首页
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        } else if (error.status === 404) {
            errorMessage = 'Car not found. Please select another car.';
        } else if (error.status === 500) {
            errorMessage = 'Server error. Please try again later.';
        } else if (error.status === 0) {
            errorMessage = 'Network error. Please check your connection.';
        }

        showError(errorMessage);

    } finally {
        // 恢复确认按钮
        $('#confirmReservation').prop('disabled', false).html(
            '<i class="fas fa-check me-1"></i>Confirm Reservation'
        );
    }
}

// 显示预订成功消息
function showReservationSuccess(order) {
    const successHtml = `
        <!-- Bootstrap和自定义CSS -->
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link rel="stylesheet" href="css/style.css">
        
        <body style="background: linear-gradient(135deg, #f8f9fa 0%, #e5ccf4 100%); min-height: 100vh;">
            <header class="navbar navbar-expand-lg navbar-dark" style="background: linear-gradient(135deg, #382d72 0%, #5c509c 100%) !important;">
                <div class="container">
                    <a class="navbar-brand fw-bold text-white" href="/" style="text-decoration: none;">
                        <i class="fas fa-car me-2" style="color: #e5ccf4;"></i>RentACar
                    </a>
                </div>
            </header>
            
            <main class="container mt-4">
                <div class="row justify-content-center">
                    <div class="col-md-10">
                        <div class="card shadow-lg border-0" style="border: 2px solid #e5ccf4; background: white;">
                            <div class="card-header text-white text-center" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;">
                                <h3><i class="fas fa-check-circle me-2"></i>Reservation Confirmed!</h3>
                            </div>
                            <div class="card-body text-center p-4">
                                <div class="mb-4">
                                    <i class="fas fa-car" style="color: #28a745; font-size: 4rem;"></i>
                                </div>
                                
                                <h4 style="color: #28a745;" class="mb-4">Thank you for your reservation!</h4>
                                
                                <div class="reservation-details rounded p-4 mb-4" style="background: linear-gradient(135deg, #e5ccf4 0%, #f0e6ff 100%); border: 1px solid #5c509c;">
                                    <div class="row">
                                        <div class="col-md-6 text-start">
                                            <p><strong>Order ID:</strong> <span class="badge" style="background: linear-gradient(135deg, #5c509c 0%, #a080e1 100%);">${order.id}</span></p>
                                            <p><strong>Car:</strong> ${selectedCar.brand} ${selectedCar.model}</p>
                                            <p><strong>Start Date:</strong> ${new Date(order.rentalPeriod.startDate).toLocaleDateString()}</p>
                                        </div>
                                        <div class="col-md-6 text-start">
                                            <p><strong>Rental Period:</strong> ${order.rentalPeriod.days} days</p>
                                            <p><strong>Total Amount:</strong> <span style="color: #28a745; font-weight: bold; font-size: 1.2rem;">${order.totalPrice}</span></p>
                                            <p><strong>Status:</strong> <span class="badge" style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);">Pending Confirmation</span></p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="alert" style="background: linear-gradient(135deg, #e5ccf4 0%, #f0e6ff 100%); border-left: 4px solid #a080e1; color: #382d72;">
                                    <i class="fas fa-info-circle me-2"></i>
                                    <strong>Next Steps:</strong><br>
                                    • You will receive a confirmation email shortly<br>
                                    • Please bring your driver's license when picking up the car<br>
                                    • Our team will contact you within 24 hours
                                </div>
                                
                                <div class="d-grid gap-2 d-md-flex justify-content-md-center">
                                    <button class="btn btn-lg me-2" onclick="window.print()" 
                                            style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border: none; color: white;">
                                        <i class="fas fa-print me-1"></i>Print Receipt
                                    </button>
                                    <button class="btn btn-lg" onclick="window.location.href='/'"
                                            style="background: linear-gradient(135deg, #5c509c 0%, #a080e1 100%); border: none; color: white;">
                                        <i class="fas fa-home me-1"></i>Back to Homepage
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            <!-- 添加悬停效果 -->
            <style>
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                }
                .card:hover {
                    transform: translateY(-5px);
                    transition: all 0.3s ease;
                }
            </style>
        </body>
    `;

    // 替换整个页面内容
    document.open();
    document.write(successHtml);
    document.close();

    // 添加庆祝效果
    setTimeout(() => {
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }, 500);
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

// 工具函数：格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Show order confirmation modal
function showOrderConfirmationModal(orderData) {
    // Populate modal with order data
    $('#modalOrderId').text('#' + orderData.id);
    $('#modalCarInfo').text(orderData.selectedCar?.make + ' ' + orderData.selectedCar?.model || 'Selected Vehicle');
    $('#modalRentalPeriod').text(orderData.rentalPeriod.startDate + ' (' + orderData.rentalPeriod.days + ' days)');
    $('#modalTotalPrice').text('$' + orderData.totalPrice);

    $('#modalCustomerName').text(orderData.customerInfo.name);
    $('#modalCustomerEmail').text(orderData.customerInfo.email);
    $('#modalCustomerPhone').text(orderData.customerInfo.phone);

    // Store order ID for confirmation
    $('#confirmOrderBtn').data('orderId', orderData.id);

    // Show modal
    $('#orderConfirmationModal').modal('show');
}

// Handle order confirmation
$(document).on('click', '#confirmOrderBtn', function () {
    const orderId = $(this).data('orderId');
    const $btn = $(this);

    // Show loading state
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Confirming...');

    // Call confirmation API
    fetch(`/api/orders/${orderId}/confirm`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Hide confirmation modal
                $('#orderConfirmationModal').modal('hide');

                // Show success modal
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
            // Reset button state
            $btn.prop('disabled', false).html('✅ Confirm Order');
        });
});

// Handle order submission success
function handleOrderSubmissionSuccess(response) {
    if (response.success) {
        // Hide any existing modals
        $('.modal').modal('hide');

        // Show confirmation modal instead of alert
        showOrderConfirmationModal(response.order);
    } else {
        alert('Failed to create order: ' + (response.message || 'Unknown error'));
    }
}

// Enhanced form validation with better error messages
function validateForm() {
    let isValid = true;

    // 使用正确的字段ID
    const fields = {
        customerName: ($('#customerName').val() || '').trim(),    // ✅ 正确ID
        customerEmail: ($('#customerEmail').val() || '').trim(),  // ✅ 正确ID
        customerPhone: ($('#customerPhone').val() || '').trim(),  // ✅ 正确ID
        driverLicense: ($('#driverLicense').val() || '').trim(),  // ✅ 正确ID
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

// Show validation errors
function showValidationErrors(errors) {
    let errorHtml = '<div class="alert alert-danger"><ul class="mb-0">';
    errors.forEach(error => {
        errorHtml += `<li>${error}</li>`;
    });
    errorHtml += '</ul></div>';

    $('#validationErrors').html(errorHtml).show();
}

// Hide validation errors
function hideValidationErrors() {
    $('#validationErrors').hide();
}