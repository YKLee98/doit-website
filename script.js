// 설정
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx6lKSN6Tp5Rsb55d4jyc4mJwmscEI1e-F7pJyjVccLLwEFbasXoXHnzav6XlcNJHa2/exec';

// 전역 변수
let isSubmitting = false;

// JSONP 콜백 함수들
window.handleLoginResponse = null;
window.handleRegisterResponse = null;
window.handleEmailCheckResponse = null;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // 현재 페이지 확인
    const isRegisterPage = window.location.pathname.includes('register.html') || window.location.search.includes('path=register');
    
    // 폼 요소 가져오기
    const form = document.getElementById(isRegisterPage ? 'registerForm' : 'loginForm');
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    
    if (!form || !nameInput || !phoneInput) {
        console.error('Required form elements not found');
        return;
    }
    
    // 전화번호 자동 포맷팅
    phoneInput.addEventListener('input', formatPhoneNumber);
    
    // 이메일 중복 확인 (회원가입 페이지만)
    if (isRegisterPage && emailInput) {
        emailInput.addEventListener('blur', checkEmailDuplicate);
    }
    
    // 폼 제출 처리
    form.addEventListener('submit', handleFormSubmit);
    
    // 첫 번째 입력 필드에 포커스
    nameInput.focus();
});

// 전화번호 포맷팅
function formatPhoneNumber(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    
    if (value.length > 0) {
        if (value.length <= 3) {
            e.target.value = value;
        } else if (value.length <= 7) {
            e.target.value = value.slice(0, 3) + '-' + value.slice(3);
        } else if (value.length <= 11) {
            e.target.value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7);
        }
    }
}

// JSONP 요청 함수
function jsonpRequest(params, callbackName) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const callbackFn = `callback_${Date.now()}`;
        
        // 전역 콜백 함수 설정
        window[callbackFn] = function(data) {
            resolve(data);
            // 스크립트 태그 제거
            document.body.removeChild(script);
            delete window[callbackFn];
        };
        
        // URL 파라미터 생성
        const url = new URL(GOOGLE_SCRIPT_URL);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });
        url.searchParams.append('callback', callbackFn);
        
        // 스크립트 태그 추가
        script.src = url.toString();
        script.onerror = () => {
            reject(new Error('JSONP request failed'));
            document.body.removeChild(script);
            delete window[callbackFn];
        };
        
        document.body.appendChild(script);
        
        // 타임아웃 설정 (10초)
        setTimeout(() => {
            if (window[callbackFn]) {
                reject(new Error('Request timeout'));
                document.body.removeChild(script);
                delete window[callbackFn];
            }
        }, 10000);
    });
}

// 이메일 중복 확인
async function checkEmailDuplicate() {
    const email = document.getElementById('email').value.trim();
    const emailError = document.getElementById('emailError');
    
    if (!email || !validateEmail(email)) return;
    
    try {
        const result = await jsonpRequest({
            action: 'checkEmail',
            email: email
        });
        
        if (result.exists) {
            showError('emailError', result.message);
        } else {
            hideError('emailError');
        }
    } catch (error) {
        console.error('Email check error:', error);
    }
}

// 폼 제출 처리
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    // 에러 메시지 초기화
    hideAllErrors();
    
    // 입력값 가져오기
    const isRegisterPage = window.location.pathname.includes('register.html') || window.location.search.includes('path=register');
    const formData = getFormData(isRegisterPage);
    
    // 유효성 검사
    if (!validateForm(formData, isRegisterPage)) {
        return;
    }
    
    // 제출 시작
    isSubmitting = true;
    const submitButton = document.getElementById('submitButton');
    const originalText = submitButton.innerHTML;
    
    if (isRegisterPage) {
        submitButton.innerHTML = '가입 처리 중<span class="loading"></span>';
    } else {
        submitButton.innerHTML = '로그인 중<span class="loading"></span>';
    }
    submitButton.disabled = true;
    
    try {
        // JSONP 요청 파라미터 준비
        const params = {
            action: isRegisterPage ? 'register' : 'login',
            ...formData
        };
        
        const result = await jsonpRequest(params);
        
        if (result.success) {
            handleSuccess(result, isRegisterPage);
        } else {
            handleError(result.message);
        }
    } catch (error) {
        console.error('Submit error:', error);
        handleError('처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
        isSubmitting = false;
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// 폼 데이터 가져오기
function getFormData(isRegisterPage) {
    const data = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim()
    };
    
    if (isRegisterPage) {
        data.email = document.getElementById('email').value.trim();
    }
    
    return data;
}

// 유효성 검사
function validateForm(formData, isRegisterPage) {
    let isValid = true;
    
    // 이름 검사
    if (!formData.name || formData.name.length < 2) {
        showError('nameError', '이름을 2자 이상 입력해주세요.');
        isValid = false;
    }
    
    // 전화번호 검사
    if (!formData.phone || !/^010-\d{3,4}-\d{4}$/.test(formData.phone)) {
        showError('phoneError', '올바른 휴대폰 번호를 입력해주세요.');
        isValid = false;
    }
    
    // 이메일 검사 (회원가입만)
    if (isRegisterPage) {
        if (!formData.email || !validateEmail(formData.email)) {
            showError('emailError', '올바른 이메일 주소를 입력해주세요.');
            isValid = false;
        }
    }
    
    return isValid;
}

// 이메일 유효성 검사
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// 성공 처리
function handleSuccess(result, isRegisterPage) {
    const successMessage = document.getElementById('successMessage');
    
    if (isRegisterPage) {
        successMessage.textContent = '회원가입이 완료되었습니다! 로그인 페이지로 이동합니다...';
        successMessage.style.display = 'block';
        
        // 폼 숨기기
        document.getElementById('registerForm').style.display = 'none';
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    } else {
        successMessage.textContent = '로그인 성공! 잠시 후 이동합니다...';
        successMessage.style.display = 'block';
        
        setTimeout(() => {
            window.location.href = result.redirectUrl;
        }, 1500);
    }
}

// 에러 처리
function handleError(message) {
    // 메시지에 따라 적절한 필드에 에러 표시
    if (message.includes('이메일')) {
        showError('emailError', message);
    } else if (message.includes('휴대폰')) {
        showError('phoneError', message);
    } else if (message.includes('이름')) {
        showError('nameError', message);
    } else {
        // 일반적인 에러는 마지막 필드에 표시
        const isRegisterPage = window.location.pathname.includes('register.html') || window.location.search.includes('path=register');
        showError(isRegisterPage ? 'emailError' : 'phoneError', message);
    }
}

// 에러 메시지 표시/숨김
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function hideAllErrors() {
    hideError('nameError');
    hideError('phoneError');
    hideError('emailError');
}
