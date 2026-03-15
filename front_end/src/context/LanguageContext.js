import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const LanguageContext = createContext();

const STORAGE_KEY = 'language';
const EN = 'en';
const AR = 'ar';

const translations = {
  en: {
    brand: 'E-Commerce',
    products: 'Products',
    login: 'Login',
    signUp: 'Sign Up',
    myOrders: 'My Orders',
    cart: 'Cart',
    wishlist: 'Wishlist',
    tickets: 'Tickets',
    admin: 'Admin',
    employee: 'Employee',
    profile: 'Profile',
    logout: 'Logout',
    email: 'Email',
    language: 'Language',
    footerTagline: 'Your trusted online shopping destination',
    quickLinks: 'Quick Links',
    account: 'Account',
    contact: 'Contact',
    allRightsReserved: 'All rights reserved.',
    discoverCollection: 'Discover our amazing collection',
    filters: 'Filters',
    search: 'Search',
    searchProducts: 'Search products...',
    category: 'Category',
    allCategories: 'All Categories',
    priceRange: 'Price Range',
    min: 'Min',
    max: 'Max',
    applyFilters: 'Apply Filters',
    productFound: 'product found',
    productsFound: 'products found',
    sortBy: 'Sort by:',
    name: 'Name',
    priceLowToHigh: 'Price: Low to High',
    priceHighToLow: 'Price: High to Low',
    noProductsFound: 'No products found. Try adjusting your filters.',
    previous: 'Previous',
    next: 'Next',
    addToCart: 'Add to cart',
    addToWishlist: 'Add to wishlist',
    removeFromWishlist: 'Remove from wishlist',
    addedToCartSuccess: 'Product added to cart!',
    addToCartFailed: 'Failed to add to cart',
    checkout: 'Checkout',
    shippingInformation: 'Shipping Information',
    address: 'Address',
    city: 'City',
    state: 'State',
    zipCode: 'Zip Code',
    country: 'Country',
    phone: 'Phone',
    processing: 'Processing...',
    placeOrder: 'Place Order',
    orderSummary: 'Order Summary',
    quantity: 'Quantity',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    free: 'Free',
    total: 'Total',
    product: 'Product',
    yourCartIsEmpty: 'Your cart is empty',
    fillRequiredFields: 'Please fill in all required fields',
    orderPlacedSuccessfully: 'Order placed successfully!',
    failedPlaceOrder: 'Failed to place order. Please try again.',
    myWishlist: 'My Wishlist',
    wishlistEmpty: 'Your wishlist is empty',
    wishlistStartAdding: 'Start adding products you love to your wishlist!',
    browseProducts: 'Browse Products',
    remove: 'Remove',
    fromWishlistQuestion: 'from wishlist?',
    clearWishlist: 'Delete All',
    clearWishlistQuestion: 'Are you sure you want to delete all items from wishlist?',
    failedClearWishlist: 'Failed to clear wishlist',
    statusCreated: 'created',
    statusPaid: 'paid',
    statusShipped: 'shipped',
    statusDelivered: 'delivered',
    statusCancelled: 'cancelled',
    networkErrorServer: 'Network Error: Unable to connect to server. Please check if the server is running.',
    failedFetchOrders: 'Failed to fetch orders',
    confirmCancelOrder: 'Are you sure you want to cancel Order',
    orderCancelledSuccessfully: 'Order cancelled successfully',
    failedCancelOrder: 'Failed to cancel order',
    noOrdersYet: "You haven't placed any orders yet.",
    startShopping: 'Start Shopping',
    order: 'Order',
    createdAt: 'Created at',
    payForOrder: 'Pay for order',
    payNow: 'Pay Now',
    cancelOrder: 'Cancel order',
    cancelling: 'Cancelling...',
    orderInformation: 'Order Information',
    createdAtTitle: 'Created At',
    totalAmount: 'Total Amount',
    noProductsInOrder: 'No products found in this order.',
    priceEach: 'Price',
    each: 'each',
    adminDashboard: 'Admin Dashboard',
    totalProducts: 'Total Products',
    totalOrders: 'Total Orders',
    totalRevenue: 'Total Revenue',
    lowStockItems: 'Low Stock Items',
    threshold: 'Threshold',
    configureThreshold: 'Configure threshold',
    configureLowStockThreshold: 'Configure Low Stock Threshold',
    lowStockThresholdDescription: 'Set the minimum quantity threshold for low stock alerts. Products with quantity below this value will be marked as low stock.',
    thresholdValue: 'Threshold Value',
    enterThreshold: 'Enter threshold',
    currentThreshold: 'Current threshold',
    updating: 'Updating...',
    manageProducts: 'Manage Products',
    addEditDeleteProducts: 'Add, edit, or delete products',
    manageCategories: 'Manage Categories',
    organizeProductCategories: 'Organize your product categories',
    viewOrders: 'View Orders',
    monitorCustomerOrders: 'Monitor customer orders',
    enterValidNumber: 'Please enter a valid number greater than 0',
    lowStockThresholdUpdated: 'Low stock threshold updated successfully',
    failedUpdateThreshold: 'Failed to update threshold',
    failedFetchProducts: 'Failed to fetch products',
    imagesUploadedSuccessfully: 'Images uploaded successfully',
    failedUploadImages: 'Failed to upload images',
    atLeastOneImageRequired: 'At least 1 image is required.',
    maxThreeImages: 'Maximum 3 images allowed',
    maxThreeImagesHint: 'Maximum 3 images allowed. Please remove some images first.',
    productIdMissing: 'Error: Product ID is missing. Please refresh and try again.',
    productUpdatedSuccessfully: 'Product updated successfully',
    productCreatedSuccessfully: 'Product created successfully',
    failedSaveProduct: 'Failed to save product',
    confirmDeleteProduct: 'Are you sure you want to delete this product?',
    productDeletedSuccessfully: 'Product deleted successfully',
    showingLowStockItems: 'Showing low stock items',
    addProduct: 'Add Product',
    noLowStockItems: 'No low stock items found. All products have sufficient inventory.',
    showAllProducts: 'Show All Products',
    stock: 'Stock',
    reviewSentiment: 'Review Sentiment',
    reviews: 'Reviews',
    viewReviews: 'View Reviews',
    edit: 'Edit',
    delete: 'Delete',
    editProduct: 'Edit Product',
    addNewProduct: 'Add New Product',
    productName: 'Product Name',
    description: 'Description',
    price: 'Price',
    categoryName: 'Category Name',
    selectCategory: 'Select a category',
    productImagesRequired: 'Product Images * (1-3 images required)',
    imagesSelected: 'images selected',
    canAddMoreImages: 'You can add more images.',
    maxImagesReached: 'Maximum 3 images reached.',
    removeImage: 'Remove image',
    cancel: 'Cancel',
    update: 'Update',
    create: 'Create',
    failedFetchCategories: 'Failed to fetch categories',
    categoryUpdatedSuccessfully: 'Category updated successfully',
    categoryCreatedSuccessfully: 'Category created successfully',
    failedSaveCategory: 'Failed to save category',
    confirmDeleteCategory: 'Are you sure you want to delete this category?',
    categoryDeletedSuccessfully: 'Category deleted successfully',
    addCategory: 'Add Category',
    editCategory: 'Edit Category',
    addNewCategory: 'Add New Category',
    revenue: 'Revenue',
    orderStatusUpdatedSuccessfully: 'Order status updated successfully',
    failedUpdateOrderStatus: 'Failed to update order status',
    allOrders: 'All Orders',
    filterByStatus: 'Filter by Status',
    orderId: 'Order ID',
    customer: 'Customer',
    date: 'Date',
    items: 'Items',
    status: 'Status',
    actions: 'Actions',
    changeStatus: 'Change status',
    noActions: 'No actions',
    assignToEmployee: 'Assign to Employee',
    updateStatus: 'Update Status',
    responses: 'Responses',
    assignTicket: 'Assign Ticket',
    assignTicketToEmployee: 'Assign ticket',
    toAnEmployee: 'to an employee',
    manageUsers: 'Manage Users',
    customer: 'Customer',
    filterByRole: 'Filter by Role',
    role: 'Role',
    verified: 'Verified',
    created: 'Created',
    changeRole: 'Change Role',
    changeUserRole: 'Change User Role',
    updateRole: 'Update Role',
    orders: 'orders',
    manageReviews: 'Manage Reviews',
    selectProduct: 'Select Product',
    allProductsOption: '-- All Products --',
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    loginSuccessful: 'Login successful',
    loginFailed: 'Login failed',
    somethingWentWrong: 'Something went wrong',
    googleLoginFailed: 'Google login failed',
    googleLoginSomethingWrong: 'Something went wrong with Google login',
    googleLoginTryAgain: 'Google login failed. Please try again.',
    welcomeBackLogin: 'Welcome back! Please login to your account.',
    enterYourEmail: 'Enter your email',
    password: 'Password',
    forgotYourPassword: 'Forgot your password?',
    enterYourPassword: 'Enter your password',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    loggingIn: 'Logging in...',
    or: 'OR',
    signingIn: 'Signing in...',
    continueWithGoogle: 'Continue with Google',
    dontHaveAccount: "Don't have an account?",
    emailRequired: 'Email is required',
    validEmailRequired: 'Please enter a valid email',
    firstNameRequired: 'First name is required',
    lastNameRequired: 'Last name is required',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 6 characters',
    passwordsNotMatch: 'Passwords do not match',
    signupFailed: 'Signup failed',
    accountCreatedLoggedIn: 'Account created and logged in successfully',
    googleSignupFailed: 'Google signup failed',
    googleSignupSomethingWrong: 'Something went wrong with Google signup',
    googleSignupTryAgain: 'Google signup failed. Please try again.',
    createNewAccount: 'Create a new account to get started.',
    firstName: 'First Name',
    enterFirstName: 'Enter your first name',
    lastName: 'Last Name',
    enterLastName: 'Enter your last name',
    phoneOptional: 'Phone (Optional)',
    enterPhoneNumber: 'Enter your phone number',
    countryOptional: 'Country (Optional)',
    enterYourCountry: 'Enter your country',
    cityOptional: 'City (Optional)',
    enterYourCity: 'Enter your city',
    streetOptional: 'Street (Optional)',
    enterStreetAddress: 'Enter your street address',
    confirmPassword: 'Confirm Password',
    confirmYourPassword: 'Confirm your password',
    creatingAccount: 'Creating account...',
    signingUp: 'Signing up...',
    alreadyHaveAccount: 'Already have an account?',
    all: 'All',
    id: 'ID',
    notVerified: 'Not Verified',
    active: 'Active',
    blocked: 'Blocked',
    newPasswordKeepCurrent: 'New Password (leave blank to keep current)',
    enterNewPassword: 'Enter new password',
    confirmNewPassword: 'Confirm New Password',
    confirmNewPasswordPlaceholder: 'Confirm new password',
    aiWelcomeMessage:
      "Hello! I'm your AI shopping assistant. I can help you find products or answer questions. How can I assist you today?",
    aiErrorMessage:
      "I apologize, but I'm having trouble processing your request right now. Please try again later.",
    aiChatClearedMessage: 'Chat cleared! How can I help you today?',
    aiShoppingAssistant: 'AI Shopping Assistant',
    toggleChat: 'Toggle chat',
    clearChat: 'Clear chat',
    closeChat: 'Close chat',
    recommendedProducts: 'Recommended Products',
    typeYourMessage: 'Type your message...',
    shoppingCart: 'Shopping Cart',
    proceedToCheckout: 'Proceed to Checkout',
    continueShopping: 'Continue Shopping',
    clearCart: 'Delete All',
    clearCartQuestion: 'Are you sure you want to delete all items from cart?',
    cartClearedSuccessfully: 'Cart cleared successfully',
    failedClearCart: 'Failed to clear cart',
    failedUpdateCart: 'Failed to update cart',
    failedRemoveCartItem: 'Failed to remove item',
    invalidItemId: 'Invalid item ID',
    commentsAndReviews: 'Comments & Reviews',
    addComment: 'Add a Comment',
    sort: 'Sort:',
    latest: 'Latest',
    oldest: 'Oldest',
    loadingComments: 'Loading comments...',
    noCommentsYet: 'No comments yet. Be the first to comment!',
    viewAllComments: 'View All Comments',
    showLess: 'Show Less',
    editCommentAndRating: 'Edit comment and rating',
    deleteComment: 'Delete comment',
    addCommentTitle: 'Add a Comment',
    backToProduct: 'Back to Product',
    starRating: 'Star Rating',
    comment: 'Comment',
    writeCommentOrReview: 'Write your comment or review...',
    updateComment: 'Update Comment',
    submitComment: 'Submit Comment',
    submitting: 'Submitting...',
    existingCommentNotice: 'You already added a comment for this product. You can edit your comment and rating.',
  },
  ar: {
    brand: 'المتجر الإلكتروني',
    products: 'المنتجات',
    login: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    myOrders: 'طلباتي',
    cart: 'السلة',
    wishlist: 'المفضلة',
    tickets: 'التذاكر',
    admin: 'المشرف',
    employee: 'الموظف',
    profile: 'الملف الشخصي',
    logout: 'تسجيل الخروج',
    email: 'البريد الإلكتروني',
    language: 'اللغة',
    footerTagline: 'وجهتك الموثوقة للتسوق عبر الإنترنت',
    quickLinks: 'روابط سريعة',
    account: 'الحساب',
    contact: 'تواصل معنا',
    allRightsReserved: 'جميع الحقوق محفوظة.',
    discoverCollection: 'اكتشف مجموعتنا المميزة',
    filters: 'الفلاتر',
    search: 'بحث',
    searchProducts: 'ابحث عن المنتجات...',
    category: 'الفئة',
    allCategories: 'كل الفئات',
    priceRange: 'نطاق السعر',
    min: 'الحد الأدنى',
    max: 'الحد الأقصى',
    applyFilters: 'تطبيق الفلاتر',
    productFound: 'منتج',
    productsFound: 'منتج',
    sortBy: 'ترتيب حسب:',
    name: 'الاسم',
    priceLowToHigh: 'السعر: من الأقل إلى الأعلى',
    priceHighToLow: 'السعر: من الأعلى إلى الأقل',
    noProductsFound: 'لم يتم العثور على منتجات. جرّب تعديل الفلاتر.',
    previous: 'السابق',
    next: 'التالي',
    addToCart: 'أضف إلى السلة',
    addToWishlist: 'أضف إلى المفضلة',
    removeFromWishlist: 'إزالة من المفضلة',
    addedToCartSuccess: 'تمت إضافة المنتج إلى السلة!',
    addToCartFailed: 'فشل في إضافة المنتج إلى السلة',
    checkout: 'إتمام الشراء',
    shippingInformation: 'معلومات الشحن',
    address: 'العنوان',
    city: 'المدينة',
    state: 'المنطقة',
    zipCode: 'الرمز البريدي',
    country: 'الدولة',
    phone: 'الهاتف',
    processing: 'جارٍ المعالجة...',
    placeOrder: 'تأكيد الطلب',
    orderSummary: 'ملخص الطلب',
    quantity: 'الكمية',
    subtotal: 'المجموع الفرعي',
    shipping: 'الشحن',
    free: 'مجاني',
    total: 'الإجمالي',
    product: 'المنتج',
    yourCartIsEmpty: 'سلتك فارغة',
    fillRequiredFields: 'يرجى تعبئة جميع الحقول المطلوبة',
    orderPlacedSuccessfully: 'تم إنشاء الطلب بنجاح!',
    failedPlaceOrder: 'فشل إنشاء الطلب. حاول مرة أخرى.',
    myWishlist: 'مفضلتي',
    wishlistEmpty: 'قائمة المفضلة فارغة',
    wishlistStartAdding: 'ابدأ بإضافة المنتجات التي تحبها إلى المفضلة!',
    browseProducts: 'تصفح المنتجات',
    remove: 'إزالة',
    fromWishlistQuestion: 'من المفضلة؟',
    clearWishlist: 'حذف الكل',
    clearWishlistQuestion: 'هل أنت متأكد أنك تريد حذف جميع عناصر المفضلة؟',
    failedClearWishlist: 'فشل في حذف جميع عناصر المفضلة',
    statusCreated: 'تم الإنشاء',
    statusPaid: 'مدفوع',
    statusShipped: 'تم الشحن',
    statusDelivered: 'تم التسليم',
    statusCancelled: 'ملغي',
    networkErrorServer: 'خطأ في الشبكة: تعذر الاتصال بالخادم. يرجى التأكد من أن الخادم يعمل.',
    failedFetchOrders: 'فشل في جلب الطلبات',
    confirmCancelOrder: 'هل أنت متأكد أنك تريد إلغاء الطلب',
    orderCancelledSuccessfully: 'تم إلغاء الطلب بنجاح',
    failedCancelOrder: 'فشل في إلغاء الطلب',
    noOrdersYet: 'لم تقم بأي طلبات بعد.',
    startShopping: 'ابدأ التسوق',
    order: 'الطلب',
    createdAt: 'أُنشئ في',
    payForOrder: 'ادفع الطلب',
    payNow: 'ادفع الآن',
    cancelOrder: 'إلغاء الطلب',
    cancelling: 'جارٍ الإلغاء...',
    orderInformation: 'معلومات الطلب',
    createdAtTitle: 'تاريخ الإنشاء',
    totalAmount: 'إجمالي المبلغ',
    noProductsInOrder: 'لا توجد منتجات في هذا الطلب.',
    priceEach: 'السعر',
    each: 'للقطعة',
    adminDashboard: 'لوحة تحكم المشرف',
    totalProducts: 'إجمالي المنتجات',
    totalOrders: 'إجمالي الطلبات',
    totalRevenue: 'إجمالي الإيرادات',
    lowStockItems: 'منتجات منخفضة المخزون',
    threshold: 'الحد الأدنى',
    configureThreshold: 'ضبط الحد',
    configureLowStockThreshold: 'ضبط حد انخفاض المخزون',
    lowStockThresholdDescription: 'حدد أقل كمية للتنبيه بانخفاض المخزون. المنتجات الأقل من هذه القيمة ستعتبر منخفضة المخزون.',
    thresholdValue: 'قيمة الحد',
    enterThreshold: 'أدخل الحد',
    currentThreshold: 'الحد الحالي',
    updating: 'جارٍ التحديث...',
    manageProducts: 'إدارة المنتجات',
    addEditDeleteProducts: 'إضافة أو تعديل أو حذف المنتجات',
    manageCategories: 'إدارة الفئات',
    organizeProductCategories: 'تنظيم فئات المنتجات',
    viewOrders: 'عرض الطلبات',
    monitorCustomerOrders: 'متابعة طلبات العملاء',
    enterValidNumber: 'يرجى إدخال رقم صحيح أكبر من 0',
    lowStockThresholdUpdated: 'تم تحديث حد انخفاض المخزون بنجاح',
    failedUpdateThreshold: 'فشل في تحديث الحد',
    failedFetchProducts: 'فشل في جلب المنتجات',
    imagesUploadedSuccessfully: 'تم رفع الصور بنجاح',
    failedUploadImages: 'فشل في رفع الصور',
    atLeastOneImageRequired: 'مطلوب صورة واحدة على الأقل.',
    maxThreeImages: 'الحد الأقصى 3 صور',
    maxThreeImagesHint: 'الحد الأقصى 3 صور. يرجى إزالة بعض الصور أولاً.',
    productIdMissing: 'خطأ: معرف المنتج مفقود. يرجى التحديث والمحاولة مرة أخرى.',
    productUpdatedSuccessfully: 'تم تحديث المنتج بنجاح',
    productCreatedSuccessfully: 'تم إنشاء المنتج بنجاح',
    failedSaveProduct: 'فشل في حفظ المنتج',
    confirmDeleteProduct: 'هل أنت متأكد أنك تريد حذف هذا المنتج؟',
    productDeletedSuccessfully: 'تم حذف المنتج بنجاح',
    showingLowStockItems: 'عرض المنتجات منخفضة المخزون',
    addProduct: 'إضافة منتج',
    noLowStockItems: 'لا توجد منتجات منخفضة المخزون. جميع المنتجات لديها مخزون كافٍ.',
    showAllProducts: 'عرض كل المنتجات',
    stock: 'المخزون',
    reviewSentiment: 'اتجاه التقييمات',
    reviews: 'التقييمات',
    viewReviews: 'عرض التقييمات',
    edit: 'تعديل',
    delete: 'حذف',
    editProduct: 'تعديل المنتج',
    addNewProduct: 'إضافة منتج جديد',
    productName: 'اسم المنتج',
    description: 'الوصف',
    price: 'السعر',
    categoryName: 'اسم الفئة',
    selectCategory: 'اختر فئة',
    productImagesRequired: 'صور المنتج * (مطلوب من 1 إلى 3 صور)',
    imagesSelected: 'صور محددة',
    canAddMoreImages: 'يمكنك إضافة المزيد من الصور.',
    maxImagesReached: 'تم الوصول إلى الحد الأقصى 3 صور.',
    removeImage: 'إزالة الصورة',
    cancel: 'إلغاء',
    update: 'تحديث',
    create: 'إنشاء',
    failedFetchCategories: 'فشل في جلب الفئات',
    categoryUpdatedSuccessfully: 'تم تحديث الفئة بنجاح',
    categoryCreatedSuccessfully: 'تم إنشاء الفئة بنجاح',
    failedSaveCategory: 'فشل في حفظ الفئة',
    confirmDeleteCategory: 'هل أنت متأكد أنك تريد حذف هذه الفئة؟',
    categoryDeletedSuccessfully: 'تم حذف الفئة بنجاح',
    addCategory: 'إضافة فئة',
    editCategory: 'تعديل الفئة',
    addNewCategory: 'إضافة فئة جديدة',
    revenue: 'الإيرادات',
    orderStatusUpdatedSuccessfully: 'تم تحديث حالة الطلب بنجاح',
    failedUpdateOrderStatus: 'فشل في تحديث حالة الطلب',
    allOrders: 'كل الطلبات',
    filterByStatus: 'تصفية حسب الحالة',
    orderId: 'رقم الطلب',
    customer: 'العميل',
    date: 'التاريخ',
    items: 'العناصر',
    status: 'الحالة',
    actions: 'الإجراءات',
    changeStatus: 'تغيير الحالة',
    noActions: 'لا توجد إجراءات',
    assignToEmployee: 'إسناد إلى موظف',
    updateStatus: 'تحديث الحالة',
    responses: 'الردود',
    assignTicket: 'إسناد التذكرة',
    assignTicketToEmployee: 'إسناد التذكرة',
    toAnEmployee: 'إلى موظف',
    manageUsers: 'إدارة المستخدمين',
    customer: 'عميل',
    filterByRole: 'تصفية حسب الدور',
    role: 'الدور',
    verified: 'موثق',
    created: 'تاريخ الإنشاء',
    changeRole: 'تغيير الدور',
    changeUserRole: 'تغيير دور المستخدم',
    updateRole: 'تحديث الدور',
    orders: 'طلبات',
    manageReviews: 'إدارة التقييمات',
    selectProduct: 'اختر المنتج',
    allProductsOption: '-- كل المنتجات --',
    positive: 'إيجابي',
    neutral: 'محايد',
    negative: 'سلبي',
    loginSuccessful: 'تم تسجيل الدخول بنجاح',
    loginFailed: 'فشل تسجيل الدخول',
    somethingWentWrong: 'حدث خطأ ما',
    googleLoginFailed: 'فشل تسجيل الدخول عبر Google',
    googleLoginSomethingWrong: 'حدث خطأ أثناء تسجيل الدخول عبر Google',
    googleLoginTryAgain: 'فشل تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.',
    welcomeBackLogin: 'مرحبًا بعودتك! يرجى تسجيل الدخول إلى حسابك.',
    enterYourEmail: 'أدخل بريدك الإلكتروني',
    password: 'كلمة المرور',
    forgotYourPassword: 'هل نسيت كلمة المرور؟',
    enterYourPassword: 'أدخل كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
    loggingIn: 'جارٍ تسجيل الدخول...',
    or: 'أو',
    signingIn: 'جارٍ تسجيل الدخول...',
    continueWithGoogle: 'المتابعة باستخدام Google',
    dontHaveAccount: 'ليس لديك حساب؟',
    emailRequired: 'البريد الإلكتروني مطلوب',
    validEmailRequired: 'يرجى إدخال بريد إلكتروني صحيح',
    firstNameRequired: 'الاسم الأول مطلوب',
    lastNameRequired: 'اسم العائلة مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    passwordMinLength: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل',
    passwordsNotMatch: 'كلمتا المرور غير متطابقتين',
    signupFailed: 'فشل إنشاء الحساب',
    accountCreatedLoggedIn: 'تم إنشاء الحساب وتسجيل الدخول بنجاح',
    googleSignupFailed: 'فشل التسجيل عبر Google',
    googleSignupSomethingWrong: 'حدث خطأ أثناء التسجيل عبر Google',
    googleSignupTryAgain: 'فشل التسجيل عبر Google. يرجى المحاولة مرة أخرى.',
    createNewAccount: 'أنشئ حسابًا جديدًا للبدء.',
    firstName: 'الاسم الأول',
    enterFirstName: 'أدخل الاسم الأول',
    lastName: 'اسم العائلة',
    enterLastName: 'أدخل اسم العائلة',
    phoneOptional: 'الهاتف (اختياري)',
    enterPhoneNumber: 'أدخل رقم الهاتف',
    countryOptional: 'الدولة (اختياري)',
    enterYourCountry: 'أدخل دولتك',
    cityOptional: 'المدينة (اختياري)',
    enterYourCity: 'أدخل مدينتك',
    streetOptional: 'الشارع (اختياري)',
    enterStreetAddress: 'أدخل عنوان الشارع',
    confirmPassword: 'تأكيد كلمة المرور',
    confirmYourPassword: 'أكد كلمة المرور',
    creatingAccount: 'جارٍ إنشاء الحساب...',
    signingUp: 'جارٍ التسجيل...',
    alreadyHaveAccount: 'لديك حساب بالفعل؟',
    all: 'الكل',
    id: 'المعرف',
    notVerified: 'غير موثق',
    active: 'نشط',
    blocked: 'محظور',
    newPasswordKeepCurrent: 'كلمة مرور جديدة (اتركه فارغًا للإبقاء على الحالية)',
    enterNewPassword: 'أدخل كلمة مرور جديدة',
    confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
    confirmNewPasswordPlaceholder: 'أكد كلمة المرور الجديدة',
    aiWelcomeMessage:
      'مرحبًا! أنا مساعد التسوق الذكي. يمكنني مساعدتك في العثور على المنتجات أو الإجابة عن الأسئلة. كيف يمكنني مساعدتك اليوم؟',
    aiErrorMessage: 'أعتذر، أواجه مشكلة في معالجة طلبك الآن. يرجى المحاولة مرة أخرى لاحقًا.',
    aiChatClearedMessage: 'تم مسح المحادثة! كيف يمكنني مساعدتك اليوم؟',
    aiShoppingAssistant: 'مساعد التسوق الذكي',
    toggleChat: 'تبديل الدردشة',
    clearChat: 'مسح المحادثة',
    closeChat: 'إغلاق الدردشة',
    recommendedProducts: 'المنتجات المقترحة',
    typeYourMessage: 'اكتب رسالتك...',
    shoppingCart: 'سلة التسوق',
    proceedToCheckout: 'المتابعة إلى الدفع',
    continueShopping: 'متابعة التسوق',
    clearCart: 'حذف الكل',
    clearCartQuestion: 'هل أنت متأكد أنك تريد حذف جميع عناصر السلة؟',
    cartClearedSuccessfully: 'تم حذف جميع عناصر السلة بنجاح',
    failedClearCart: 'فشل في حذف عناصر السلة',
    failedUpdateCart: 'فشل في تحديث السلة',
    failedRemoveCartItem: 'فشل في حذف العنصر',
    invalidItemId: 'معرّف العنصر غير صالح',
    commentsAndReviews: 'التعليقات والتقييمات',
    addComment: 'أضف تعليقًا',
    sort: 'ترتيب:',
    latest: 'الأحدث',
    oldest: 'الأقدم',
    loadingComments: 'جارٍ تحميل التعليقات...',
    noCommentsYet: 'لا توجد تعليقات بعد. كن أول من يعلّق!',
    viewAllComments: 'عرض كل التعليقات',
    showLess: 'عرض أقل',
    editCommentAndRating: 'تعديل التعليق والتقييم',
    deleteComment: 'حذف التعليق',
    addCommentTitle: 'أضف تعليقًا',
    backToProduct: 'العودة إلى المنتج',
    starRating: 'تقييم النجوم',
    comment: 'التعليق',
    writeCommentOrReview: 'اكتب تعليقك أو تقييمك...',
    updateComment: 'تحديث التعليق',
    submitComment: 'إرسال التعليق',
    submitting: 'جارٍ الإرسال...',
    existingCommentNotice: 'لقد أضفت تعليقًا لهذا المنتج بالفعل. يمكنك تعديل تعليقك وتقييمك.',
  },
};

const uiTextTranslations = {
  'Dashboard': 'لوحة التحكم',
  'Admin Dashboard': 'لوحة تحكم المشرف',
  'Employee Dashboard': 'لوحة تحكم الموظف',
  'Admin Panel': 'لوحة المشرف',
  'Employee Panel': 'لوحة الموظف',
  'Shopping Cart': 'سلة التسوق',
  'My Orders': 'طلباتي',
  'My Profile': 'ملفي الشخصي',
  'My Wishlist': 'مفضلتي',
  'Comments & Reviews': 'التعليقات والتقييمات',
  'Product Details': 'تفاصيل المنتج',
  'Home': 'الرئيسية',
  'Manage Products': 'إدارة المنتجات',
  'Manage Categories': 'إدارة الفئات',
  'All Orders': 'كل الطلبات',
  'Manage Users': 'إدارة المستخدمين',
  'All Tickets': 'كل التذاكر',
  'Manage Reviews': 'إدارة التقييمات',
  'Products': 'المنتجات',
  'Categories': 'الفئات',
  'Orders': 'الطلبات',
  'Users': 'المستخدمون',
  'Tickets': 'التذاكر',
  'Reviews': 'التقييمات',
  'View Tickets': 'عرض التذاكر',
  'View and manage your assigned tickets': 'عرض وإدارة التذاكر المعينة لك',
  'Order Summary': 'ملخص الطلب',
  'Subtotal:': 'المجموع الفرعي:',
  'Shipping:': 'الشحن:',
  'Free': 'مجاني',
  'Total:': 'الإجمالي:',
  'Proceed to Checkout': 'المتابعة إلى الدفع',
  'Continue Shopping': 'متابعة التسوق',
  'Your cart is empty': 'سلتك فارغة',
  'Start Shopping': 'ابدأ التسوق',
  'Featured Products': 'منتجات مميزة',
  'Shop by Category': 'تسوق حسب الفئة',
  'Shop Now': 'تسوق الآن',
  'View All Products': 'عرض كل المنتجات',
  'Welcome to Our Store': 'مرحباً بكم في متجرنا',
  'Discover amazing products at unbeatable prices': 'اكتشف منتجات رائعة بأسعار لا تقبل المنافسة',
  'Out of Stock': 'غير متوفر',
  'Available': 'متوفر',
  'Description': 'الوصف',
  'Quantity:': 'الكمية:',
  'Add to Cart': 'أضف إلى السلة',
  'Remove from Wishlist': 'إزالة من المفضلة',
  'Add to Wishlist': 'أضف إلى المفضلة',
  'Back to Products': 'العودة إلى المنتجات',
  'Back to Users': 'العودة إلى المستخدمين',
  'User Account Information': 'معلومات حساب المستخدم',
  'Personal Information': 'المعلومات الشخصية',
  'Address Information': 'معلومات العنوان',
  'Account Information': 'معلومات الحساب',
  'Verification Status:': 'حالة التحقق:',
  'Provider:': 'الموفر:',
  'Account Created:': 'تاريخ إنشاء الحساب:',
  'Created at:': 'أُنشئ في:',
  'Created:': 'تاريخ الإنشاء:',
  'Customer:': 'العميل:',
  'Assigned to:': 'مُسند إلى:',
  'Filter by Status:': 'تصفية حسب الحالة:',
  'Filter by Assigned To:': 'تصفية حسب المعيّن:',
  'Filter by Role:': 'تصفية حسب الدور:',
  'Filter by': 'تصفية حسب',
  'Status': 'الحالة',
  'Actions': 'الإجراءات',
  'Change status...': 'تغيير الحالة...',
  'No actions': 'لا توجد إجراءات',
  'Retry': 'إعادة المحاولة',
  'Cancel': 'إلغاء',
  'Create': 'إنشاء',
  'Update': 'تحديث',
  'Save': 'حفظ',
  'Edit': 'تعديل',
  'Delete': 'حذف',
  'Deleting...': 'جارٍ الحذف...',
  'Updating...': 'جارٍ التحديث...',
  'Creating...': 'جارٍ الإنشاء...',
  'Sending...': 'جارٍ الإرسال...',
  'Assigning...': 'جارٍ الإسناد...',
  'Approving...': 'جارٍ الموافقة...',
  'Rejecting...': 'جارٍ الرفض...',
  'Block': 'حظر',
  'Unblock': 'إلغاء الحظر',
  'Blocking...': 'جارٍ الحظر...',
  'Unblocking...': 'جارٍ إلغاء الحظر...',
  'Change Role': 'تغيير الدور',
  'Update Role': 'تحديث الدور',
  'Delete User': 'حذف المستخدم',
  'Assign Ticket': 'إسناد تذكرة',
  'Assign': 'إسناد',
  'Send Response': 'إرسال الرد',
  'Add Response': 'إضافة رد',
  'Responses': 'الردود',
  'No responses yet.': 'لا توجد ردود بعد.',
  'Create New Ticket': 'إنشاء تذكرة جديدة',
  '+ Create New Ticket': '+ إنشاء تذكرة جديدة',
  'Create Ticket': 'إنشاء تذكرة',
  'Create Your First Ticket': 'أنشئ أول تذكرة لك',
  'My Tickets': 'تذاكري',
  'Assigned Tickets': 'التذاكر المعينة',
  'No tickets found.': 'لا توجد تذاكر.',
  'No orders found.': 'لا توجد طلبات.',
  'No users found': 'لا يوجد مستخدمون',
  'No comments yet. Be the first to comment!': 'لا توجد تعليقات بعد. كن أول من يعلّق!',
  'Loading comments...': 'جارٍ تحميل التعليقات...',
  'Show Less': 'عرض أقل',
  'Post Comment': 'نشر التعليق',
  'Posting...': 'جارٍ النشر...',
  'Email:': 'البريد الإلكتروني:',
  'Name:': 'الاسم:',
  'Phone:': 'الهاتف:',
  'Address:': 'العنوان:',
  'Role:': 'الدور:',
  'Member Since:': 'عضو منذ:',
  'First Name': 'الاسم الأول',
  'Last Name': 'اسم العائلة',
  'Email': 'البريد الإلكتروني',
  'Phone': 'الهاتف',
  'Country': 'الدولة',
  'City': 'المدينة',
  'Street': 'الشارع',
  'Update Profile': 'تحديث الملف الشخصي',
  'Choose Image': 'اختر صورة',
  'Update Image': 'تحديث الصورة',
  'Delete Image': 'حذف الصورة',
  'Uploading...': 'جارٍ الرفع...',
  'Admin': 'مشرف',
  'Employee': 'موظف',
  'Customer': 'عميل',
  'All': 'الكل',
  'Resolved': 'تم الحل',
  'Closed': 'مغلق',
  'In Progress': 'قيد المعالجة',
  'Unassigned': 'غير مُسند',
  'Select Employee': 'اختر موظفاً',
  'Select Product:': 'اختر المنتج:',
  '-- All Products --': '-- كل المنتجات --',
  'Analyze Sentiment for This Product': 'تحليل المشاعر لهذا المنتج',
  'Analyzing...': 'جارٍ التحليل...',
  'Positive': 'إيجابي',
  'Neutral': 'محايد',
  'Negative': 'سلبي',
  'Review Sentiment:': 'اتجاه التقييمات:',
  'Pending Delete Requests': 'طلبات الحذف المعلقة',
  'Approve & Delete': 'موافقة وحذف',
  'Reject': 'رفض',
  'Delete Ticket': 'حذف التذكرة',
  'Request Delete': 'طلب حذف',
  'Requesting...': 'جارٍ الطلب...',
  'Please select an employee': 'يرجى اختيار موظف',
  'Please enter a message': 'يرجى إدخال رسالة',
  'Please fill in all fields': 'يرجى تعبئة جميع الحقول',
  'Please enter a comment': 'يرجى إدخال تعليق',
  'Please login to post a comment': 'يرجى تسجيل الدخول لنشر تعليق',
  'Please login to add items to cart': 'يرجى تسجيل الدخول لإضافة عناصر إلى السلة',
  'Comment posted successfully!': 'تم نشر التعليق بنجاح!',
  'Comment deleted successfully': 'تم حذف التعليق بنجاح',
  'Ticket created successfully': 'تم إنشاء التذكرة بنجاح',
  'Ticket assigned successfully': 'تم إسناد التذكرة بنجاح',
  'Ticket status updated': 'تم تحديث حالة التذكرة',
  'Response added successfully': 'تمت إضافة الرد بنجاح',
  'Response updated successfully': 'تم تحديث الرد بنجاح',
  'Response deleted successfully': 'تم حذف الرد بنجاح',
  'Delete request rejected': 'تم رفض طلب الحذف',
  'Delete request submitted. Waiting for admin approval.': 'تم إرسال طلب الحذف. بانتظار موافقة المشرف.',
  'Product added to cart!': 'تمت إضافة المنتج إلى السلة!',
  'Failed to add to cart': 'فشل في إضافة المنتج إلى السلة',
  'Cart updated': 'تم تحديث السلة',
  'Item removed from cart': 'تمت إزالة العنصر من السلة',
  'Your trusted online shopping destination': 'وجهتك الموثوقة للتسوق عبر الإنترنت',
};

const translateDynamicText = (text) => {
  const dynamicRules = [
    [/^Order #(\d+)$/, 'طلب رقم $1'],
    [/^Order #(\d+)/, 'طلب رقم $1'],
    [/^Created at:\s*(.+)$/, 'أُنشئ في: $1'],
    [/^Created:\s*(.+)$/, 'تاريخ الإنشاء: $1'],
    [/^Total:\s*(.+)$/, 'الإجمالي: $1'],
    [/^Price:\s*(.+)\s+each$/, 'السعر: $1 لكل قطعة'],
    [/^Quantity:\s*(.+)$/, 'الكمية: $1'],
    [/^View All Comments \((\d+)\)$/, 'عرض كل التعليقات ($1)'],
    [/^Products \((\d+)\)$/, 'المنتجات ($1)'],
    [/^Responses \((\d+)\)$/, 'الردود ($1)'],
    [/^All \((\d+)\)$/, 'الكل ($1)'],
    [/^Positive \((\d+)\)$/, 'إيجابي ($1)'],
    [/^Neutral \((\d+)\)$/, 'محايد ($1)'],
    [/^Negative \((\d+)\)$/, 'سلبي ($1)'],
    [/^Threshold:\s*(.+)$/, 'الحد الأدنى: $1'],
    [/^Current threshold:\s*(.+)$/, 'الحد الحالي: $1'],
    [/^\((\d+)\s+orders\)$/, '($1 طلبات)'],
    [/^\((\d+)\s+order\)$/, '($1 طلب)'],
  ];

  for (const [pattern, replacement] of dynamicRules) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement);
    }
  }

  return text;
};

const translateUiText = (value, isArabic) => {
  if (!isArabic || typeof value !== 'string') {
    return value;
  }

  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  const direct = uiTextTranslations[trimmed];
  if (direct) {
    return `${leading}${direct}${trailing}`;
  }

  const dynamic = translateDynamicText(trimmed);
  if (dynamic !== trimmed) {
    return `${leading}${dynamic}${trailing}`;
  }

  return value;
};

const getInitialLanguage = () => {
  const savedLanguage = localStorage.getItem(STORAGE_KEY);
  return savedLanguage === AR ? AR : EN;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(getInitialLanguage);
  const isApplyingRef = useRef(false);
  const originalTextNodeMap = useRef(new Map());

  useEffect(() => {
    const direction = language === AR ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.dir = direction;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const getArabicVersion = (text) => translateUiText(text, true);

    const restoreAttributes = () => {
      const attrs = ['placeholder', 'title', 'aria-label', 'value'];

      attrs.forEach((attr) => {
        const marker = `data-i18n-original-${attr}`;
        const nodes = document.querySelectorAll(`[${marker}]`);

        nodes.forEach((el) => {
          const original = el.getAttribute(marker);
          const current = el.getAttribute(attr);
          if (original !== null && current === getArabicVersion(original)) {
            el.setAttribute(attr, original);
          }
          el.removeAttribute(marker);
        });
      });
    };

    const applyToAttributes = (isArabic) => {
      const attrs = ['placeholder', 'title', 'aria-label'];
      attrs.forEach((attr) => {
        const nodes = document.querySelectorAll(`[${attr}]`);
        nodes.forEach((el) => {
          const marker = `data-i18n-original-${attr}`;
          const current = el.getAttribute(attr);
          if (current === null) return;

          if (!el.hasAttribute(marker)) {
            el.setAttribute(marker, current);
          }

          const baseText = el.getAttribute(marker) || current;
          el.setAttribute(attr, translateUiText(baseText, isArabic));
        });
      });

      const valueNodes = document.querySelectorAll(
        'input[type="button"], input[type="submit"], input[type="reset"], button[value]'
      );

      valueNodes.forEach((el) => {
        const marker = 'data-i18n-original-value';
        const current = el.getAttribute('value');
        if (current === null) return;

        if (!el.hasAttribute(marker)) {
          el.setAttribute(marker, current);
        }

        const baseText = el.getAttribute(marker) || current;
        el.setAttribute('value', translateUiText(baseText, isArabic));
      });
    };

    const applyTranslations = () => {
      if (!document.body || isApplyingRef.current) {
        return;
      }

      isApplyingRef.current = true;
      const shouldTranslate = language === AR;

      if (!shouldTranslate) {
        originalTextNodeMap.current.forEach((original, node) => {
          if (node && node.isConnected) {
            const arabicValue = getArabicVersion(original);
            if (node.nodeValue === arabicValue) {
              node.nodeValue = original;
            }
          }
        });
        originalTextNodeMap.current.clear();
        restoreAttributes();
        isApplyingRef.current = false;
        return;
      }

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            const parent = node.parentElement;
            if (!parent) {
              return NodeFilter.FILTER_REJECT;
            }
            const tag = parent.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      textNodes.forEach((node) => {
        if (!originalTextNodeMap.current.has(node)) {
          originalTextNodeMap.current.set(node, node.nodeValue);
        }
        const originalText = originalTextNodeMap.current.get(node) || node.nodeValue;
        node.nodeValue = translateUiText(originalText, true);
      });

      applyToAttributes(true);
      isApplyingRef.current = false;
    };

    let rafId = null;
    const scheduleApply = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        applyTranslations();
      });
    };

    applyTranslations();

    const observer = new MutationObserver(() => {
      if (language === AR) {
        scheduleApply();
      }
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === EN ? AR : EN));
  }, []);

  const t = useCallback(
    (key, fallback = '') => translations[language][key] || fallback || key,
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      isArabic: language === AR,
      isRTL: language === AR,
      toggleLanguage,
      t,
      tr: (text) => translateUiText(text, language === AR),
    }),
    [language, toggleLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
