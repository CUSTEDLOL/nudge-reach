from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "Jhinesh_V_Jain_College_CV.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = HexColor("#17324D")
BLUE = HexColor("#2F6F8F")
TEXT = HexColor("#1F2933")
MUTED = HexColor("#52606D")
LINE = HexColor("#D9E2EC")
PALE = HexColor("#F3F7FA")
WHITE = HexColor("#FFFFFF")

styles = getSampleStyleSheet()

name_style = ParagraphStyle(
    "Name",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=22,
    leading=25,
    textColor=NAVY,
    spaceAfter=2,
)
contact_style = ParagraphStyle(
    "Contact",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=11,
    textColor=MUTED,
)
section_style = ParagraphStyle(
    "Section",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9.4,
    leading=11,
    textColor=BLUE,
    spaceBefore=5,
    spaceAfter=3,
)
body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.35,
    leading=10.7,
    textColor=TEXT,
    alignment=TA_LEFT,
    spaceAfter=1.5,
)
role_style = ParagraphStyle(
    "Role",
    parent=body_style,
    fontName="Helvetica-Bold",
    textColor=NAVY,
    spaceAfter=0.5,
)
meta_style = ParagraphStyle(
    "Meta",
    parent=body_style,
    fontName="Helvetica-Oblique",
    fontSize=7.9,
    leading=9.5,
    textColor=MUTED,
    spaceAfter=1.4,
)
bullet_style = ParagraphStyle(
    "Bullet",
    parent=body_style,
    leftIndent=8,
    firstLineIndent=-6,
    bulletIndent=1,
    spaceAfter=1,
)
tag_style = ParagraphStyle(
    "Tag",
    parent=body_style,
    fontSize=7.8,
    leading=9.2,
    textColor=NAVY,
)


def section(title):
    heading = Paragraph(title.upper(), section_style)
    rule = Table([[""]], colWidths=[174 * mm], rowHeights=[0.5 * mm])
    rule.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LINE),
        ("LINEBELOW", (0, 0), (-1, -1), 0, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([heading, rule, Spacer(1, 1.5 * mm)])


def bullet(text):
    return Paragraph(f"<bullet>&#8226;</bullet>{text}", bullet_style)


def role(title, year=None):
    if year:
        data = [[Paragraph(title, role_style), Paragraph(year, role_style)]]
        table = Table(data, colWidths=[147 * mm, 27 * mm])
        table.setStyle(TableStyle([
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        return table
    return Paragraph(title, role_style)


def header(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1] - 7 * mm, A4[0], 7 * mm, stroke=0, fill=1)
    canvas.setFillColor(BLUE)
    canvas.rect(0, 0, A4[0], 3 * mm, stroke=0, fill=1)
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=13 * mm,
    bottomMargin=10 * mm,
    title="Jhinesh V. Jain - College Application CV",
    author="Jhinesh V. Jain",
    subject="College application curriculum vitae",
)

story = [
    Paragraph("JHINESH V. JAIN", name_style),
    Paragraph("Chennai, India &nbsp;&nbsp;|&nbsp;&nbsp; +91 98845 44296 &nbsp;&nbsp;|&nbsp;&nbsp; jhineshjain@gmail.com", contact_style),
    Spacer(1, 2.5 * mm),
    section("Profile"),
    Paragraph(
        "Commerce student with a strong academic record and interests in finance, economics, accountancy and data analysis. "
        "Interested in using technology to understand practical business problems. Demonstrates initiative through independent "
        "application development, event leadership, competitive badminton, theatre and commerce competitions. Aspires to pursue "
        "a business or finance related undergraduate degree alongside the Chartered Accountancy qualification.",
        body_style,
    ),
    section("Education"),
    role("Padma Seshadri Bala Bhavan Senior Secondary School, Chennai", "Expected 2027"),
    Paragraph("CBSE Class XII", meta_style),
    Paragraph("Subjects: Accountancy, Mathematics, Business Studies, Economics and English", body_style),
    Paragraph("Class XI: 92% &nbsp;&nbsp;|&nbsp;&nbsp; Class X: 91%", body_style),
    section("Academic Achievements"),
    role("Second Place, Connect with Commerce Business Quiz", "2025"),
    Paragraph("PSBB Millennium School, OMR", meta_style),
    bullet("Secured second place in an interschool commerce and business quiz."),
    bullet("Demonstrated commercial awareness, business knowledge and analytical thinking."),
    Spacer(1, 1.2 * mm),
    role("All Rounder Award, Grade 6"),
    bullet("Recognised among the top 5% of students in the class for academic distinction."),
    section("Leadership and Responsibility"),
    role("Event In-Charge, Green Screen, Reverberations", "2026"),
    Paragraph("Padma Seshadri Bala Bhavan Senior Secondary School", meta_style),
    bullet("Coordinated event operations involving approximately 40 to 50 participants and volunteers."),
    bullet("Managed registrations, competition rules, scheduling, judging coordination and technical setup."),
    section("Projects"),
    role("Regression Analysis Tool"),
    bullet("Built a basic data science application for performing regression analysis."),
    bullet("Applied introductory statistical and data analysis concepts through practical development."),
    Spacer(1, 1 * mm),
    role("MIT App Inventor Applications"),
    bullet("Developed functional applications including a scientific calculator and grade converter."),
    bullet("Gained practical experience in interface design, logical problem-solving and testing."),
    Spacer(1, 1 * mm),
    role("AI and LLM Exploration"),
    bullet("Explored generative AI and large language models for creating simple applications and tools."),
    section("Activities"),
    role("Solo Stage Actor, War Within, Crea-Shakthi Summer Solos", "2025"),
    bullet("Performed a solo theatrical production, demonstrating independent preparation, stage presence and audience engagement."),
    Spacer(1, 1 * mm),
    role("Competitive Badminton", "2025"),
    bullet("Competed at district level and contributed to the winning team at the city-level CKPL Badminton Competition in Chennai."),
    section("Skills and Interests"),
]

skills = [
    "Microsoft Excel, PowerPoint and Word",
    "Tally",
    "Python fundamentals",
    "MIT App Inventor",
    "Canva",
    "Generative AI and LLM tools",
    "Basic data analysis and regression",
    "Event coordination and public speaking",
]
skill_cells = [[Paragraph(skills[i], tag_style), Paragraph(skills[i + 1], tag_style)] for i in range(0, len(skills), 2)]
skill_table = Table(skill_cells, colWidths=[87 * mm, 87 * mm])
skill_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PALE),
    ("BOX", (0, 0), (-1, -1), 0.4, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))
story.extend([
    skill_table,
    Spacer(1, 1.6 * mm),
    Paragraph(
        "<b>Academic interests:</b> Finance, Economics, Accountancy, Business Analytics, Data Science, Entrepreneurship and Chartered Accountancy",
        body_style,
    ),
])

doc.build(story, onFirstPage=header, onLaterPages=header)
print(OUTPUT)
