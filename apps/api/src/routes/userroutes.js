import express from "express";
import { assignMerchantPermissionsToUserRole, changePasswordWithTemporary, createUser, deleteUser, forgotPassword, getAllUsers, getMyPreferences, getUserById, getUserDetails, loginUser, resetPassword, sendPhoneLoginOtp, toggleUserActive, updateMyFcmToken, updateMyPreferences, updateUser, verifyPhoneLoginOtp } from "../controllers/user.js";
import { signupCustomerAccount, sendCustomerSignupPhoneOtp, verifyCustomerSignupPhoneOtp, verifyStoreReferencePublic } from "../controllers/customerProfile.js";
import {
    sendShopOwnerSignupEmailOtp,
    verifyShopOwnerSignupEmailOtp,
    sendCustomerChangeEmailOtp,
    verifyCustomerChangeEmailOtp,
} from "../controllers/emailVerification.js";
import { sendChangePhoneOtp, verifyChangePhoneOtp } from "../controllers/changePhone.js";
import { removeMyProfileImage, setMyProfileImage, uploadProfileImage } from "../controllers/userProfileImage.js";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission, requireAnyPermission } from "../middleware/requirePermission.js";
import { otpSendLimit, credentialCheckLimit, publicFormLimit, uploadLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Public auth routes first so they are never captured by `/:id` (e.g. GET /users/login).
router.post('/login', credentialCheckLimit, loginUser);
router.post('/phone-login/send-otp', otpSendLimit, sendPhoneLoginOtp);
router.post('/phone-login/verify', credentialCheckLimit, verifyPhoneLoginOtp);
router.post('/forgot-password', otpSendLimit, forgotPassword);
router.post('/customer-signup/verify-reference', publicFormLimit, verifyStoreReferencePublic);
router.post('/customer-signup/send-otp', otpSendLimit, sendCustomerSignupPhoneOtp);
router.post('/customer-signup/verify-otp', credentialCheckLimit, verifyCustomerSignupPhoneOtp);
router.post('/customer-signup', publicFormLimit, signupCustomerAccount);
router.post('/shop-owner-signup/send-email-otp', otpSendLimit, sendShopOwnerSignupEmailOtp);
router.post('/shop-owner-signup/verify-email-otp', credentialCheckLimit, verifyShopOwnerSignupEmailOtp);

router.post('/', auth, requireActiveSubscription, requireFeature('users.create'), requirePermission('users.create'), createUser);
router.get('/', auth, requireActiveSubscription, requireAnyPermission('users.view', 'users.create', 'users.update'), getAllUsers);
/** Allow inactive subscriptions so clients can show profile/billing renewal (session + RTK still gate the rest of the app). */
router.get('/me', auth, getUserById);
router.post('/me/profile-image', auth, requireActiveSubscription, uploadLimit, uploadProfileImage.single("image"), setMyProfileImage);
router.delete('/me/profile-image', auth, requireActiveSubscription, removeMyProfileImage);
router.get('/me/preferences', auth, requireActiveSubscription, getMyPreferences);
router.put('/me/preferences', auth, requireActiveSubscription, updateMyPreferences);
/** Device push token — no subscription gate so renewal alerts can still target the device. */
router.put('/me/fcm-token', auth, updateMyFcmToken);
/** Profile contact change — OTP to the new email/phone; no subscription gate. */
router.post('/me/change-email/send-otp', auth, otpSendLimit, sendCustomerChangeEmailOtp);
router.post('/me/change-email/verify', auth, credentialCheckLimit, verifyCustomerChangeEmailOtp);
router.post('/me/change-phone/send-otp', auth, otpSendLimit, sendChangePhoneOtp);
router.post('/me/change-phone/verify', auth, credentialCheckLimit, verifyChangePhoneOtp);
router.put('/toggle-active', auth, requireActiveSubscription, requirePermission('users.toggle_active'), toggleUserActive);
router.post('/assign-merchant-permissions', auth, requireActiveSubscription, requirePermission('users.update'), assignMerchantPermissionsToUserRole);
router.post('/reset-password', auth, requireActiveSubscription, resetPassword);
router.post('/change-password', auth, requireActiveSubscription, changePasswordWithTemporary);
router.put('/:id/delete', auth, requireActiveSubscription, requirePermission('users.delete'), deleteUser);
router.put('/:id', auth, requireActiveSubscription, updateUser);
router.get('/:id', auth, requireActiveSubscription, requireAnyPermission('users.details.view', 'users.view'), getUserDetails);

export default router;