import express from "express";
import { assignMerchantPermissionsToUserRole, changePasswordWithTemporary, createUser, deleteUser, forgotPassword, getAllUsers, getMyPreferences, getUserById, getUserDetails, loginUser, resetPassword, toggleUserActive, updateMyPreferences, updateUser } from "../controllers/user.js";
import { signupCustomerAccount, verifyStoreReferencePublic } from "../controllers/customerProfile.js";
import {
    sendShopOwnerSignupEmailOtp,
    verifyShopOwnerSignupEmailOtp,
} from "../controllers/emailVerification.js";
import { removeMyProfileImage, setMyProfileImage, uploadProfileImage } from "../controllers/userProfileImage.js";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";

const router = express.Router();

router.post('/', auth, requireActiveSubscription, createUser);
router.get('/', auth, requireActiveSubscription, getAllUsers);
/** Allow inactive subscriptions so clients can show profile/billing renewal (session + RTK still gate the rest of the app). */
router.get('/me', auth, getUserById);
router.post('/me/profile-image', auth, requireActiveSubscription, uploadProfileImage.single("image"), setMyProfileImage);
router.delete('/me/profile-image', auth, requireActiveSubscription, removeMyProfileImage);
router.get('/me/preferences', auth, requireActiveSubscription, getMyPreferences);
router.put('/me/preferences', auth, requireActiveSubscription, updateMyPreferences);
router.put('/toggle-active', auth, requireActiveSubscription, toggleUserActive);
router.post('/assign-merchant-permissions', auth, requireActiveSubscription, assignMerchantPermissionsToUserRole);
router.put('/:id/delete', auth, requireActiveSubscription, deleteUser);
router.put('/:id', auth, requireActiveSubscription, updateUser);
router.get('/:id', auth, requireActiveSubscription, getUserDetails);
router.post('/login', loginUser);
router.post('/customer-signup/verify-reference', verifyStoreReferencePublic);
router.post('/customer-signup', signupCustomerAccount);
router.post('/shop-owner-signup/send-email-otp', sendShopOwnerSignupEmailOtp);
router.post('/shop-owner-signup/verify-email-otp', verifyShopOwnerSignupEmailOtp);
router.post('/system-add', createUser);
router.post('/reset-password', auth, requireActiveSubscription, resetPassword);
router.post('/change-password', auth, requireActiveSubscription, changePasswordWithTemporary);
router.post('/forgot-password', forgotPassword);

export default router;