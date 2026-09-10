import { Link } from 'react-router-dom';

const howToPlayItems = [
  'Each round shows a group of stats and one player card for each stat in that group.',
  'Spin the player cards, then tap a player and tap the stat you want that player to fill.',
  'A round is complete when every stat shown in that round has a player assigned to it.',
  'Height, weight, and wingspan are body measurements. They do not get their own final score, but they can raise or lower other stats based on how well the body fits the build.',
  'Use the bench slot to save one revealed player for later. After you bench a player, re-spin the empty card and keep playing the round.',
  'In the final risk round, you can replace one completed stat or skip the risk and keep your build as-is.',
  'After the last round, your card shows its overall, archetype, player drawing, strengths, weaknesses, and options to save or share it.',
];

const privacyItems = [
  'Build-A-Baller collects the information needed to run the site, including account details, saved cards, leaderboard entries, collection progress, prize progress, contest entries, votes, and feedback.',
  'Public areas may show your username, saved cards, player names, mottos, countries or flags, drawings, leaderboards, Player of the Day results, contest entries, and vote totals.',
  'Contest drawings you submit may be shown in the contest gallery, popular rankings, and related prize pages.',
  'Build-A-Baller uses browser storage to keep you signed in, remember game progress, save drawing drafts, and support voting or prize features.',
  'The site does not need advertising cookies to work.',
  'For privacy questions or removal requests, contact baballersupport@gmail.com.',
];

const termsItems = [
  'Use Build-A-Baller fairly. Do not abuse accounts, leaderboards, voting, prizes, or game systems.',
  'You may not submit hateful, racist, antisemitic, homophobic, sexually explicit, threatening, harassing, impersonating, or otherwise inappropriate content.',
  'Saved card content and contest entries may be reviewed, hidden, removed, or disqualified if they break the rules or harm the experience for other players.',
  'Prize details, voting rules, deadlines, eligibility, and tie-break decisions may be updated to keep contests fair and working correctly. The NBA 2K27 contest winner will receive a digital code for NBA 2K27 Ultra Edition.',
  'Build-A-Baller may update rules, stats, drawings, prizes, leaderboards, accounts, or saved data to improve the game, fix issues, handle moderation, or keep the experience fair.',
  'Build-A-Baller artwork, card designs, code, text, and game design belong to Build-A-Baller or its creator. You may share your own saved cards for personal, non-commercial use.',
  'Build-A-Baller is provided as is and may change, reset, or become unavailable at times.',
  'Questions about these terms can be sent to baballersupport@gmail.com.',
];

function LegalBubbleList({ items }: { items: string[] }) {
  return (
    <div className="legal-text-bubbles">
      {items.map(item => {
        const email = 'baballersupport@gmail.com';
        if (!item.includes(email)) return <p key={item}>{item}</p>;
        const [before, after] = item.split(email);
        return (
          <p key={item}>
            {before}
            <a href={`mailto:${email}`}>{email}</a>
            {after}
          </p>
        );
      })}
    </div>
  );
}

export function HowToPlayPage() {
  return (
    <section className="legal-page">
      <h2 className="results-title">How to Play</h2>
      <div className="legal-card legal-info-card">
        <LegalBubbleList items={howToPlayItems} />
        <Link className="btn btn-primary" to="/play">Play</Link>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <section className="legal-page">
      <h2 className="results-title">Privacy Policy</h2>
      <div className="legal-card legal-info-card">
        <LegalBubbleList items={privacyItems} />
      </div>
    </section>
  );
}

export function TermsPage() {
  return (
    <section className="legal-page">
      <h2 className="results-title">Terms of Use</h2>
      <div className="legal-card legal-info-card">
        <LegalBubbleList items={termsItems} />
      </div>
    </section>
  );
}
