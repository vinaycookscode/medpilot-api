export enum AbhaKycType {
  AADHAAR = 'aadhaar',
  DRIVING_LICENSE = 'driving_license',
  MOBILE = 'mobile',
}

export enum AbhaFlowStep {
  OTP_SENT = 'otp_sent',
  ENROLLED = 'enrolled',
  FAILED = 'failed',
}

export enum AbhaFlowType {
  AADHAAR_OTP = 'aadhaar_otp',
  DRIVING_LICENSE = 'driving_license',
  MOBILE_OTP = 'mobile_otp',
  VERIFY_OTP = 'verify_otp',
}

// Must match ABDM API loginHint values exactly
export enum AbhaLoginHint {
  ABHA_NUMBER = 'abha-number',
  MOBILE = 'mobile',
  AADHAAR = 'aadhaar',
}

export enum AbhaAuditAction {
  ABHA_CREATE_INITIATE = 'ABHA_CREATE_INITIATE',
  ABHA_CREATE_COMPLETE = 'ABHA_CREATE_COMPLETE',
  ABHA_ADDRESS_CREATE = 'ABHA_ADDRESS_CREATE',
  ABHA_CARD_DOWNLOAD = 'ABHA_CARD_DOWNLOAD',
  ABHA_LINK = 'ABHA_LINK',
  ABHA_UNLINK = 'ABHA_UNLINK',
  ABHA_VERIFY_INITIATE = 'ABHA_VERIFY_INITIATE',
  ABHA_VERIFY_COMPLETE = 'ABHA_VERIFY_COMPLETE',
  ABHA_PROFILE_FETCH = 'ABHA_PROFILE_FETCH',
}
