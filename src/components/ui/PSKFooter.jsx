// Shared PSK footer — drop into any page
export default function PSKFooter() {
  return (
    <div className="text-center text-[10px] text-slate-400 py-6 px-4 border-t border-slate-100 mt-4">
      <p className="font-medium">CalorAI v1.0 · Portfolio Project</p>
      <p className="mt-0.5">
        Built by{' '}
        <a
          href="https://linkedin.com/in/partha-sarathi-komati"
          target="_blank"
          rel="noreferrer"
          className="text-blue-500 font-semibold hover:underline"
        >
          Partha Sarathi Komati
        </a>
        {' '}· IIM Udaipur
      </p>
    </div>
  )
}
