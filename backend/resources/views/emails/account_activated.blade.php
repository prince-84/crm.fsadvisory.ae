<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Activated — FS Advisory CRM</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F1EA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1B2A4A;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F4F1EA; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(8, 20, 40, 0.08); border: 1px solid #E8E2D9;">
          
          <!-- Gold Accent Bar -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #C9A84C 0%, #E5C368 50%, #C9A84C 100%);"></td>
          </tr>

          <!-- Header Banner -->
          <tr>
            <td style="background-color: #081428; padding: 36px 40px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- Brand Crest Badge -->
                    <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: rgba(201, 168, 76, 0.15); border: 1px solid #C9A84C; border-radius: 10px; font-size: 20px; color: #C9A84C; font-weight: bold; margin-bottom: 12px;">
                      FS
                    </div>
                    <div style="font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: 2px; text-transform: uppercase;">
                      FS ADVISORY
                    </div>
                    <div style="font-size: 11px; color: #C9A84C; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px; font-weight: 600;">
                      Private Office & Real Estate Advisory · Dubai
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notice Header -->
          <tr>
            <td style="padding: 36px 40px 10px 40px;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #ECFDF5; border: 1px solid #10B981; border-radius: 20px; font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
                ✓ Account Approved & Active
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #081428; line-height: 1.3;">
                Welcome to FS Advisory CRM
              </h1>
              <p style="margin: 14px 0 0 0; font-size: 14px; line-height: 1.6; color: #4A5568;">
                Dear <strong>{{ $user->name }}</strong>,
              </p>
              <p style="margin: 10px 0 0 0; font-size: 14px; line-height: 1.6; color: #4A5568;">
                Great news! Your account request has been officially <strong>approved and activated</strong> by the executive administration. Your security permissions and assigned workspace are now fully provisioned.
              </p>
            </td>
          </tr>

          <!-- Details Card -->
          <tr>
            <td style="padding: 20px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; border: 1px solid #E8E2D9; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #EFECE6;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Registered Email</span><br>
                    <span style="font-size: 14px; font-weight: 600; color: #081428; font-family: monospace;">{{ $user->email }}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #EFECE6;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Assigned Department</span><br>
                    <span style="font-size: 14px; font-weight: 600; color: #081428;">{{ $user->department ?? 'General Sales' }}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #EFECE6;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Designated Role</span><br>
                    <span style="font-size: 14px; font-weight: 600; color: #C9A84C;">{{ $user->role ?? 'Property Consultant' }}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Security Status</span><br>
                    <span style="font-size: 13px; font-weight: 700; color: #047857;">Active · Full Workspace Access Granted</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary Call to Action Button -->
          <tr>
            <td align="center" style="padding: 10px 40px 30px 40px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #081428 0%, #1A2B4C 100%); border: 1px solid #C9A84C;">
                    <a href="{{ $loginUrl ?? 'http://localhost:3000/login' }}" target="_blank" style="display: inline-block; padding: 16px 36px; font-size: 14px; font-weight: 700; color: #C9A84C; text-decoration: none; letter-spacing: 1px; text-transform: uppercase;">
                      Verify & Sign In to CRM Portal →
                    </a>
                  </td>
                </tr>
              </table>
              <div style="font-size: 11px; color: #7A7A7A; margin-top: 14px;">
                Direct URL: <a href="{{ $loginUrl ?? 'http://localhost:3000/login' }}" style="color: #081428; text-decoration: underline;">{{ $loginUrl ?? 'http://localhost:3000/login' }}</a>
              </div>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 36px 40px; font-size: 12px; line-height: 1.5; color: #7A7A7A;">
              <strong>Security Reminder:</strong> Please keep your login credentials confidential. If you need any assistance setting up your workspace, contact support at <a href="mailto:admin@fsadvisory.ae" style="color: #C9A84C; font-weight: 600; text-decoration: none;">admin@fsadvisory.ae</a>.
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #081428; padding: 26px 40px; text-align: center; border-top: 1px solid #1B2A4A;">
              <div style="font-size: 11px; color: #A0AEC0; line-height: 1.6;">
                <strong>FS Advisory Real Estate LLC</strong><br>
                Downtown Dubai, United Arab Emirates<br>
                <span style="color: #C9A84C;">notifications@crm.fsadvisory.ae</span> · Confidential Corporate Notice
              </div>
              <div style="font-size: 10px; color: #718096; margin-top: 10px;">
                © {{ date('Y') }} FS Advisory CRM. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
