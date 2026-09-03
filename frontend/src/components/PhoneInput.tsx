'use client';

import { PhoneInput as ReactPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

interface PhoneInputProps {
  value: string;
  onChange: (phone: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  hasError?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder,
  className = '',
  required = false,
  hasError = false,
}: PhoneInputProps) {
  const borderClass = hasError
    ? '!border-red-500 focus:!border-red-500 !bg-red-50/30'
    : '!border-[#E8E4DC] focus:!border-[#C8A147] !bg-[#FAF8F5]';

  return (
    <div className={`w-full ${className}`}>
      <ReactPhoneInput
        defaultCountry="ae"
        value={value}
        onChange={(phone) => onChange(phone)}
        placeholder={placeholder}
        required={required}
        className="flex items-center w-full"
        inputClassName={`!w-full !p-2.5 ${borderClass} !rounded-r-md !text-xs !text-[#1A1A1A] !font-mono focus:!bg-white focus:!outline-none !h-[38px]`}
        countrySelectorStyleProps={{
          buttonClassName: `!p-2 ${borderClass} !border-r-0 !rounded-l-md !h-[38px] hover:!bg-[#F3EEDD]`,
          dropdownStyleProps: {
            className: '!z-50 !bg-white !border !border-[#E8E4DC] !rounded-md !shadow-xl !max-h-56 !text-xs text-[#1A1A1A]',
          },
        }}
      />
    </div>
  );
}
