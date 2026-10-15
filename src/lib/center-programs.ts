import { Baby, Scissors, Cross, HandCoins, ShoppingBasket, HeartHandshake } from "lucide-react";

/** Community programs, separate from the Quran student registry. */
export const departmentDetails = {
  training: {
    introduction:
      "برامج تعليمية ومهنية وصحية لأفراد المجتمع، من التعليم المبكر إلى اكتساب المهارات والتأهيل للعمل.",
    beneficiaries:
      "الأطفال والشباب والنساء والرجال من المجتمع، بحسب الفئة المناسبة لكل برنامج، ولا يشترط التسجيل في قسم القرآن الكريم.",
    areas: [
      {
        id: "early-education",
        title: "التعليم المبكر",
        description: "التأسيس التعليمي وتنمية مهارات الأطفال قبل الالتحاق بالمدرسة.",
        icon: Baby,
        programs: [
          {
            id: "kindergarten",
            name: "روضة",
            description: "أنشطة تعلم ولعب وتنمية المهارات الأساسية للأطفال.",
          },
          {
            id: "preschool",
            name: "تمهيدي",
            description: "تهيئة الأطفال للانتقال إلى التعليم الأساسي.",
          },
        ],
      },
      {
        id: "vocational-training",
        title: "التدريب المهني والحرفي",
        description: "تنمية المهارات العملية والإبداعية التي تساعد على العمل والإنتاج.",
        icon: Scissors,
        programs: [
          { id: "sewing", name: "خياطة", description: "تعلم مهارات الخياطة والتفصيل." },
          { id: "embroidery", name: "تطريز", description: "تعلم تقنيات التطريز والأعمال اليدوية." },
          { id: "naqsh", name: "نقش", description: "تنمية مهارات النقش والزخرفة." },
          {
            id: "design",
            name: "تصميم",
            description: "تنمية مهارات التصميم والإبداع بحسب تخصص الدورة.",
          },
        ],
      },
      {
        id: "health-training",
        title: "التأهيل الصحي والمجتمعي",
        description: "تنمية مهارات الاستجابة الأولية وتعزيز الوعي بسلامة المجتمع.",
        icon: Cross,
        programs: [
          {
            id: "first-aid",
            name: "إسعافات أولية",
            description: "تدريب على التعامل الأولي مع الإصابات والحالات الطارئة.",
          },
        ],
      },
    ],
  },
  care: {
    introduction:
      "برامج مجتمعية للمساعدات الغذائية والمالية ورعاية الأيتام تعليميًا ودعمهم اقتصاديًا، وفق احتياجات المستفيدين.",
    beneficiaries:
      "الأفراد والأسر المحتاجة والأيتام من المجتمع، وفق معايير الاستحقاق لكل برنامج، ولا يشترط التسجيل في قسم القرآن الكريم.",
    areas: [
      {
        id: "food-assistance",
        title: "المساعدات الغذائية",
        description: "مساندة الأسر المحتاجة في توفير احتياجاتها الغذائية.",
        icon: ShoppingBasket,
        programs: [
          {
            id: "food-baskets",
            name: "توزيع سلال غذائية",
            description: "تقديم السلال الغذائية للأسر المستحقة.",
          },
        ],
      },
      {
        id: "financial-assistance",
        title: "المساعدات المالية",
        description: "تقديم الدعم النقدي للأفراد والأسر المستحقة من المجتمع.",
        icon: HandCoins,
        programs: [
          {
            id: "cash-assistance",
            name: "توزيع مبالغ مالية",
            description: "مساعدات نقدية بحسب الاحتياج ومعايير الاستحقاق.",
          },
        ],
      },
      {
        id: "orphan-care",
        title: "رعاية الأيتام وكفالتهم",
        description: "رعاية تعليمية وكفالة اقتصادية للأيتام بحسب احتياجاتهم.",
        icon: HeartHandshake,
        programs: [
          {
            id: "orphan-education",
            name: "الرعاية التعليمية للأيتام",
            description: "مساندة اليتيم في احتياجاته التعليمية ومتابعة استمراره في التعليم.",
          },
          {
            id: "orphan-sponsorship",
            name: "الكفالة الاقتصادية للأيتام",
            description: "دعم احتياجات اليتيم المعيشية من خلال الكفالة المالية.",
          },
        ],
      },
    ],
  },
};

export type CommunityDepartment = keyof typeof departmentDetails;
