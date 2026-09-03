<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Under Review — FS Advisory CRM</title>
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
              <div style="display: inline-block; padding: 4px 12px; background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 20px; font-size: 11px; font-weight: 700; color: #B45309; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
                ⏳ Application in Review
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #081428; line-height: 1.3;">
                Registration Request Received
              </h1>
              <p style="margin: 14px 0 0 0; font-size: 14px; line-height: 1.6; color: #4A5568;">
                Dear <strong>{{ $user->name }}</strong>,
              </p>
              <p style="margin: 10px 0 0 0; font-size: 14px; line-height: 1.6; color: #4A5568;">
                Thank you for submitting your registration request for the <strong>FS Advisory CRM Portal</strong>. Your account has been provisioned and is currently awaiting administrative approval and role assignment.
              </p>
            </td>
          </tr>

          <!-- Details Card -->
          <tr>
            <td style="padding: 20px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; border: 1px solid #E8E2D9; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #EFECE6;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Full Name</span><br>
                    <span style="font-size: 14px; font-weight: 600; color: #081428;">{{ $user->name }}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #EFECE6;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Registered Email</span><br>
                    <span style="font-size: 14px; font-weight: 600; color: #081428; font-family: monospace;">{{ $user->email }}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #EFECE6;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Contact Phone</span><br>
                    <span style="font-size: 14px; font-weight: 600; color: #081428; font-family: monospace;">{{ $user->phone ?? 'Not Provided' }}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="font-size: 11px; font-weight: 600; color: #7A7A7A; text-transform: uppercase; letter-spacing: 0.5px;">Current Status</span><br>
                    <span style="font-size: 13px; font-weight: 700; color: #B45309;">Inactive — Pending Executive Review</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps Explanation -->
          <tr>
            <td style="padding: 10px 40px 30px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; border-radius: 4px; padding: 14px 18px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: 700; color: #1E40AF; margin-bottom: 4px;">
                      What happens next?
                    </div>
                    <div style="font-size: 12.5px; color: #3B82F6; line-height: 1.5;">
                      Our management team is verifying your registration. Once your account is authorized, your department and permissions will be assigned and you will receive an official activation confirmation email with your direct login link.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Support Contact -->
          <tr>
            <td style="padding: 0 40px 36px 40px; font-size: 12px; line-height: 1.5; color: #7A7A7A;">
              If you have any urgent inquiries regarding your account activation, please reach out directly to the administrator at <a href="mailto:admin@fsadvisory.ae" style="color: #C9A84C; font-weight: 600; text-decoration: none;">admin@fsadvisory.ae</a>.
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
