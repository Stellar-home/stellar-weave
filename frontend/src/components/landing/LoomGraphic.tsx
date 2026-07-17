export default function LoomGraphic() {
  return (
    <svg viewBox="0 0 560 520" fill="none" aria-hidden="true" className="block h-auto w-full">
      <path className="thread thread-animate" stroke="#6b7590" strokeWidth="1.2" opacity=".55" d="M110,70 Q210,30 300,55" style={{ animationDelay: ".05s" }} />
      <path className="thread thread-animate" stroke="#6b7590" strokeWidth="1.2" opacity=".55" d="M300,55 Q410,90 470,140" style={{ animationDelay: ".15s" }} />
      <path className="thread thread-animate" stroke="#c9a24b" strokeWidth="1.6" opacity=".85" d="M110,70 Q150,150 190,215" style={{ animationDelay: ".25s" }} />
      <path className="thread thread-animate" stroke="#6b7590" strokeWidth="1.2" opacity=".55" d="M190,215 Q300,175 380,255" style={{ animationDelay: ".3s" }} />
      <path className="thread thread-animate" stroke="#c9a24b" strokeWidth="1.6" opacity=".85" d="M470,140 Q450,205 380,255" style={{ animationDelay: ".35s" }} />
      <path className="thread thread-animate" stroke="#6b7590" strokeWidth="1.2" opacity=".55" d="M190,215 Q160,300 130,355" style={{ animationDelay: ".42s" }} />
      <path className="thread thread-animate" stroke="#c9a24b" strokeWidth="1.6" opacity=".85" d="M380,255 Q400,335 345,395" style={{ animationDelay: ".48s" }} />
      <path className="thread thread-animate" stroke="#6b7590" strokeWidth="1.2" opacity=".55" d="M130,355 Q240,340 345,395" style={{ animationDelay: ".55s" }} />
      <path className="thread thread-animate" stroke="#6b7590" strokeWidth="1.2" opacity=".55" d="M345,395 Q440,370 505,375" style={{ animationDelay: ".6s" }} />
      <path className="thread thread-animate" stroke="#c9a24b" strokeWidth="1.6" opacity=".85" d="M300,55 Q360,150 380,255" style={{ animationDelay: ".2s" }} />
      <path className="thread thread-animate" stroke="#6b7590" strokeWidth="1.2" opacity=".55" d="M470,140 Q500,255 505,375" style={{ animationDelay: ".4s" }} />

      <circle className="node-animate" cx="110" cy="70" r="6" fill="#c9a24b" />
      <circle className="node-animate" cx="300" cy="55" r="5" fill="#c9a24b" />
      <circle className="node-animate" cx="470" cy="140" r="6" fill="#c9a24b" />
      <circle className="node-animate" cx="190" cy="215" r="5" fill="#c9a24b" />
      <circle className="node-animate" cx="380" cy="255" r="7" fill="#c9a24b" />
      <circle className="node-animate" cx="130" cy="355" r="5" fill="#c9a24b" />
      <circle className="node-animate" cx="345" cy="395" r="6" fill="#c9a24b" />
      <circle className="node-animate" cx="505" cy="375" r="5" fill="#c9a24b" />

      <text x="386" y="245" className="font-mono" fontSize="10" fill="#6b7590" letterSpacing=".03em">reputation</text>
      <text x="60" y="60" className="font-mono" fontSize="10" fill="#6b7590" letterSpacing=".03em">identity</text>
      <text x="351" y="415" className="font-mono" fontSize="10" fill="#6b7590" letterSpacing=".03em">follow</text>
    </svg>
  );
}
