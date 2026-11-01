interface ViolinIconProps {
  className?: string
}

export function ViolinIcon({ className = 'h-6 w-6' }: ViolinIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M31.9 35.5c-4.8-7-12.9-8.9-17.1-3.8-5.4 6.5 1.4 14.2 8.3 16.7-8.8 3.8-14.6 13.5-9.1 22.1 4.1 6.4 12.8 5.8 17.9-.9 5.2 6.7 13.9 7.3 18 .9 5.5-8.6-.3-18.3-9.1-22.1 6.9-2.5 13.7-10.2 8.3-16.7-4.2-5.1-12.3-3.2-17.2 3.8Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M28.5 71.5h7v10h-7z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
      <path d="M30.2 31.5V15h3.6v16.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 15h8l-1.4-8h-5.2L28 15Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M27 83h10M24 88h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30.5 18v58M33.5 18v58" stroke="currentColor" strokeWidth="1" strokeOpacity="0.75" />
      <path d="M23.5 43c-3 2.5-3 7 0 9M40.5 43c3 2.5 3 7 0 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M31.5 56v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M55 8 9 88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m54 6 3 2-46 82-3-2L54 6Z" fill="currentColor" fillOpacity="0.12" />
    </svg>
  )
}
