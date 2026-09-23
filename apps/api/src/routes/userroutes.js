import express from "express";
import { assignMerchantPermissionsToUserRole, changePasswordWithTemporary, createUser, deleteUser, forgotPassword, getAllUsers, getMyPreferences, getUserById, getUserDetails, loginUser, resetPassword, sendPhoneLoginOtp, toggleUserActive, updateMyFcmToken, updateMyPreferences, updateUser, verifyPhoneLoginOtp } from "../controllers/user.js";
import { signupCustomerAccount, sendCustomerSignupPhoneOtp, verifyCustomerSignupPhoneOtp, verifyStoreReferencePublic } from "../controllers/customerProfile.js";
import {
    sendShopOwnerSignupEmailOtp,
    verifyShopOwnerSignupEmailOtp,
} from "../controllers/emailVerification.js";
import { removeMyProfileImage, setMyProfileImage, uploadProfileImage } from "../controllers/userProfileImage.js";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";

const router = express.Router();

// Public auth routes first so they are never captured by `/:id` (e.g. GET /users/login).
router.post('/login', loginUser);
router.post('/phone-login/send-otp', sendPhoneLoginOtp);
router.post('/phone-login/verify', verifyPhoneLoginOtp);
router.post('/forgot-password', forgotPassword);
router.post('/customer-signup/verify-reference', verifyStoreReferencePublic);
router.post('/customer-signup/send-otp', sendCustomerSignupPhoneOtp);
router.post('/customer-signup/verify-otp', verifyCustomerSignupPhoneOtp);
router.post('/customer-signup', signupCustomerAccount);
router.post('/shop-owner-signup/send-email-otp', sendShopOwnerSignupEmailOtp);
router.post('/shop-owner-signup/verify-email-otp', verifyShopOwnerSignupEmailOtp);
router.post('/system-add', createUser);

router.post('/', auth, requireActiveSubscription, createUser);
router.get('/', auth, requireActiveSubscription, getAllUsers);
/** Allow inactive subscriptions so clients can show profile/billing renewal (session + RTK still gate the rest of the app). */
router.get('/me', auth, getUserById);
router.post('/me/profile-image', auth, requireActiveSubscription, uploadProfileImage.single("image"), setMyProfileImage);
router.delete('/me/profile-image', auth, requireActiveSubscription, removeMyProfileImage);
router.get('/me/preferences', auth, requireActiveSubscription, getMyPreferences);
router.put('/me/preferences', auth, requireActiveSubscription, updateMyPreferences);
/** Device push token — no subscription gate so renewal alerts can still target the device. */
router.put('/me/fcm-token', auth, updateMyFcmToken);
router.put('/toggle-active', auth, requireActiveSubscription, toggleUserActive);
router.post('/assign-merchant-permissions', auth, requireActiveSubscription, assignMerchantPermissionsToUserRole);
router.post('/reset-password', auth, requireActiveSubscription, resetPassword);
router.post('/change-password', auth, requireActiveSubscription, changePasswordWithTemporary);
router.put('/:id/delete', auth, requireActiveSubscription, deleteUser);
router.put('/:id', auth, requireActiveSubscription, updateUser);
router.get('/:id', auth, requireActiveSubscription, getUserDetails);

export default router;