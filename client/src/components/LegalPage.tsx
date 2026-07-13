import { Link } from 'react-router-dom';

export function HowToPlayPage() {
  return (
    <section className="legal-page">
      <h2 className="results-title">How to Play</h2>
      <div className="legal-card">
        <p>Spin three players each round, choose one stat, and build your baller one decision at a time.</p>
        <p>Body choices do not have their own final score. Height, weight, and wingspan change your other stats, so a build can gain or lose points based on how well the body fits the skill set.</p>
        <p>You can use the bench slot to save one player for later, and the final gambling round lets you replace one stat if you want to take the risk.</p>
        <p>At the end, you get an overall, archetype, player drawing, strengths, weaknesses, and the option to save your card to the leaderboard.</p>
        <Link className="btn btn-primary" to="/">Play</Link>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <section className="legal-page">
      <h2 className="results-title">Privacy Policy</h2>
      <div className="legal-card">
        <p>Build-A-Baller collects the information needed to run the game, including account details, saved cards, leaderboard entries, collection data, market purchases, feedback, and custom drawing requests.</p>
        <p>If you submit a photo drawing request, the uploaded photo is used to review and complete that request. Do not upload a photo unless you have permission from the person in it.</p>
        <p>Payments are processed by Stripe. Build-A-Baller does not store full card numbers.</p>
        <p>Some information may be public, including usernames, saved player cards, player names, mottos, countries or flags, drawings used on cards, leaderboards, and Player of the Day results.</p>
        <p>Build-A-Baller uses local browser storage and account data to keep you signed in and remember game features. The site does not need advertising cookies to work.</p>
        <p>For privacy questions or removal requests, contact <a href="mailto:eputterman2@gmail.com">eputterman2@gmail.com</a>.</p>
      </div>
    </section>
  );
}

export function TermsPage() {
  return (
    <section className="legal-page">
      <h2 className="results-title">Terms of Use</h2>
      <div className="legal-card">
        <p>By using Build-A-Baller, you agree to play fairly, use appropriate names and content, and avoid abusing accounts, leaderboards, payments, or game systems.</p>
        <p>You may not submit hateful, racist, antisemitic, homophobic, sexually explicit, threatening, harassing, impersonating, or otherwise inappropriate content.</p>
        <p>Custom drawing requests are reviewed before being accepted. Inappropriate names or photos will not be accepted. Market purchases are digital items and are final unless required otherwise by law.</p>
        <p>Pro player request drawings may become part of the public game pool. Photo request drawings are available to the buyer, but they may be publicly visible if used on a saved card.</p>
        <p>Build-A-Baller may update rules, odds, stats, drawings, market items, leaderboards, accounts, or saved data to improve the game, fix issues, handle moderation, or keep the experience fair.</p>
        <p>Build-A-Baller artwork, card designs, code, text, and game design belong to Build-A-Baller or its creator. You may share your own saved cards for personal, non-commercial use.</p>
        <p>Build-A-Baller is provided as is. It may change, break, reset, or become unavailable at times.</p>
        <p>Questions about these terms can be sent to <a href="mailto:eputterman2@gmail.com">eputterman2@gmail.com</a>.</p>
      </div>
    </section>
  );
}
