<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ $emailSubject }}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1B2A4A;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="620" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; width: 100%; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(8, 20, 40, 0.08); border: 1px solid #E8E2D9;">
          
          <!-- Gold Accent Bar -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #C9A84C 0%, #E5C368 50%, #C9A84C 100%);"></td>
          </tr>

          <!-- Header Banner -->
          <tr>
            <td style="background-color: #081428; padding: 32px 40px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- Brand Crest Badge -->
                    <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: rgba(201, 168, 76, 0.15); border: 1px solid #C9A84C; border-radius: 10px; font-size: 20px; color: #C9A84C; font-weight: bold; margin-bottom: 10px;">
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

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 36px 40px 20px 40px;">
              <div style="font-size: 15px; line-height: 1.7; color: #2D3748;">
                {!! nl2br(e($emailBody)) !!}
              </div>
            </td>
          </tr>

          <!-- Property Specs Summary Card (If available) -->
          @if(!empty($propertyDetails['project']) || !empty($propertyDetails['community']) || !empty($propertyDetails['budget']))
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; border: 1px solid #E8E2D9; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td colspan="2" style="background-color: #081428; padding: 10px 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: #C9A84C; text-transform: uppercase; letter-spacing: 1px;">
                      ✦ Selected Property Specification
                    </span>
                  </td>
                </tr>
                @if(!empty($propertyDetails['project']))
                <tr>
                  <td width="35%" style="padding: 10px 16px; border-bottom: 1px solid #EFECE6; font-size: 12px; color: #7A7A7A; font-weight: 600; text-transform: uppercase;">Project</td>
                  <td width="65%" style="padding: 10px 16px; border-bottom: 1px solid #EFECE6; font-size: 13px; color: #081428; font-weight: 700;">{{ $propertyDetails['project'] }}</td>
                </tr>
                @endif
                @if(!empty($propertyDetails['community']))
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #EFECE6; font-size: 12px; color: #7A7A7A; font-weight: 600; text-transform: uppercase;">Community / Area</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #EFECE6; font-size: 13px; color: #081428; font-weight: 700;">{{ $propertyDetails['community'] }}</td>
                </tr>
                @endif
                @if(!empty($propertyDetails['property_type']))
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #EFECE6; font-size: 12px; color: #7A7A7A; font-weight: 600; text-transform: uppercase;">Type & Bedrooms</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #EFECE6; font-size: 13px; color: #081428; font-weight: 700;">
                    {{ $propertyDetails['property_type'] }} {{ !empty($propertyDetails['bedrooms']) ? '· ' . $propertyDetails['bedrooms'] : '' }}
                  </td>
                </tr>
                @endif
                @if(!empty($propertyDetails['budget']))
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; color: #7A7A7A; font-weight: 600; text-transform: uppercase;">Guide Budget</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #081428; font-weight: 700;">{{ $propertyDetails['budget'] }}</td>
                </tr>
                @endif
              </table>
            </td>
          </tr>
          @endif

          <!-- Agent Signature Card -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #E8E2D9; padding-top: 24px;">
                <tr>
                  <td width="56" valign="top" style="padding-right: 16px;">
                    <div style="width: 50px; height: 50px; line-height: 50px; border-radius: 50%; background-color: #081428; color: #C9A84C; font-weight: 700; font-size: 18px; text-align: center; border: 2px solid #C9A84C;">
                      {{ strtoupper(substr($agentName, 0, 1)) }}{{ strtoupper(substr(strstr($agentName, ' ') ?: $agentName, 1, 1)) }}
                    </div>
                  </td>
                  <td valign="top">
                    <div style="font-size: 15px; font-weight: 700; color: #081428; margin-bottom: 2px;">
                      {{ $agentName }}
                    </div>
                    <div style="font-size: 12px; color: #C9A84C; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                      Senior Property Consultant · FS Advisory Dubai
                    </div>
                    <table border="0" cellspacing="0" cellpadding="0" style="font-size: 12px; color: #4A5568;">
                      <tr>
                        <td style="padding-right: 16px;">✉️ <a href="mailto:{{ $agentEmail }}" style="color: #081428; text-decoration: none; font-weight: 600;">{{ $agentEmail }}</a></td>
                        @if(!empty($agentPhone))
                        <td>📱 <a href="tel:{{ $agentPhone }}" style="color: #081428; text-decoration: none; font-weight: 600;">{{ $agentPhone }}</a></td>
                        @endif
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Legal & Disclaimers -->
          <tr>
            <td style="background-color: #FAF8F5; border-top: 1px solid #E8E2D9; padding: 24px 40px; text-align: center;">
              <div style="font-size: 11px; color: #7A7A7A; line-height: 1.6;">
                <strong>FS Advisory Real Estate LLC</strong><br>
                Dubai Headquarters · Private Office & Wealth Advisory · Business Bay, Dubai, UAE<br>
                RERA ORN Registered · DLD Regulatory Compliant
              </div>
              <div style="font-size: 10px; color: #9E9E9E; margin-top: 12px; line-height: 1.5;">
                This communication is confidential and intended solely for {{ $clientName }}. Direct replies to this message are delivered to your dedicated property advisor at {{ $agentEmail }}.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
