export type StarterTemplate = {
  name: string;
  subject: string;
  html_body: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Spring Menu — Restaurants",
    subject: "Fresh picks: our new spring menu",
    html_body: `<h2>Hello {{First Name}},</h2>
<p>Spring is here and so is our new menu. Come try our seasonal dishes:</p>
<ul>
  <li>Citrus-glazed salmon</li>
  <li>Heirloom tomato burrata</li>
  <li>Strawberry basil tart</li>
</ul>
<p>Dine-in or order online — we'd love to see you.</p>
<p>— The Team</p>`,
  },
  {
    name: "Weekly Class Schedule — Health & Fitness",
    subject: "This week's classes are up",
    html_body: `<h2>Hi {{First Name}},</h2>
<p>Here's what's on the schedule this week:</p>
<ul>
  <li>Mon 6am — HIIT</li>
  <li>Wed 7pm — Vinyasa Yoga</li>
  <li>Sat 9am — Mobility &amp; Recovery</li>
</ul>
<p>Book your spot in the app.</p>
<p>See you on the mat,<br/>The Studio</p>`,
  },
  {
    name: "Monthly Donor Update — Non-Profit",
    subject: "This month's impact report",
    html_body: `<h2>Dear {{First Name}},</h2>
<p>Thanks to supporters like you, this month we:</p>
<ul>
  <li>Served 1,200 meals to families in need</li>
  <li>Funded 3 new community programs</li>
  <li>Expanded our volunteer network by 40%</li>
</ul>
<p>Want to help keep the momentum? <a href="#">Donate here</a>.</p>
<p>With gratitude,<br/>The Team</p>`,
  },
  {
    name: "New Arrivals — Retail / Ecomm",
    subject: "Just in: new arrivals you'll love",
    html_body: `<h2>Hi {{First Name}},</h2>
<p>New drops are live in the store. A quick peek:</p>
<ul>
  <li>Spring essentials collection</li>
  <li>Limited-edition accessories</li>
  <li>Member-only early access</li>
</ul>
<p><a href="#">Shop now</a> while sizes last.</p>
<p>— The Store</p>`,
  },
];
