/**
 * Migration: 2026.10.22.00.00.04.add_multilingual_locales_and_translations.js
 * Description: Registers bn (Bengali), es (Spanish), pl (Polish), pa (Punjabi), ur (Urdu)
 *              in i18n_locale, updates court_jurisdictions constraints and indices,
 *              and seeds metadata translations (court jurisdictions, case types, presets)
 *              across Hindi, Bengali, Welsh, Spanish, and Polish.
 */

async function executeSql(ctx, sql) {
  if (typeof ctx.raw === 'function') {
    return ctx.raw(sql);
  }
  if (typeof ctx.query === 'function') {
    return ctx.query(sql);
  }
  throw new Error('Unsupported migration context: neither ctx.raw nor ctx.query is available');
}

module.exports = {
  /**
   * Apply migration
   */
  async up(ctx) {
    // 1. Register new locales in i18n_locale
    const newLocales = [
      { code: 'bn', name: 'Bengali (bn)', docId: 'locale_bengali_bn' },
      { code: 'es', name: 'Spanish (es)', docId: 'locale_spanish_es' },
      { code: 'pl', name: 'Polish (pl)', docId: 'locale_polish_pl' },
      { code: 'pa', name: 'Punjabi (pa)', docId: 'locale_punjabi_pa' },
      { code: 'ur', name: 'Urdu (ur)', docId: 'locale_urdu_ur' },
    ];

    for (const loc of newLocales) {
      await executeSql(ctx, `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM i18n_locale WHERE code = '${loc.code}') THEN
            INSERT INTO i18n_locale (document_id, name, code, created_at, updated_at, published_at)
            VALUES ('${loc.docId}', '${loc.name}', '${loc.code}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
          END IF;
        END $$;
      `);
    }

    // 2. Configure court_jurisdictions table for i18n
    await executeSql(ctx, `
      UPDATE court_jurisdictions SET locale = 'en' WHERE locale IS NULL;
      ALTER TABLE court_jurisdictions DROP CONSTRAINT IF EXISTS court_jurisdictions_name_key;
      ALTER TABLE court_jurisdictions DROP CONSTRAINT IF EXISTS court_jurisdictions_code_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_court_jurisdictions_code_locale ON court_jurisdictions (code, locale);
      CREATE INDEX IF NOT EXISTS idx_court_jurisdictions_doc_locale ON court_jurisdictions (document_id, locale);
      CREATE INDEX IF NOT EXISTS idx_court_jurisdictions_locale ON court_jurisdictions (locale);
    `);

    // 3. Seed localized translations for Court Jurisdictions
    const courtTranslations = [
      // Hindi (hi)
      { docId: 'court_fam_01', code: 'family-court', locale: 'hi', name: 'पारिवारिक न्यायालय', desc: 'निजी एवं सार्वजनिक कानून मामलों के लिए इंग्लैंड और वेल्स का एकल पारिवारिक न्यायालय' },
      { docId: 'court_hc_02', code: 'high-court-family-division', locale: 'hi', name: 'उच्च न्यायालय (पारिवारिक प्रभाग)', desc: 'जटिल, अंतरराष्ट्रीय और संरक्षकता कार्यवाही के लिए उच्च न्यायालय का पारिवारिक प्रभाग' },
      // Bengali (bn)
      { docId: 'court_fam_01', code: 'family-court', locale: 'bn', name: 'পারিবারিক আদালত', desc: 'ব্যক্তিগত ও সার্বজনীন পারিবারিক আইন সংক্রান্ত একক আদালত' },
      { docId: 'court_hc_02', code: 'high-court-family-division', locale: 'bn', name: 'হাইকোর্ট (ফ্যামিলি ডিভিশন)', desc: 'জটিল ও আন্তর্জাতিক পারিবারিক মামলার জন্য হাইকোর্টের ফ্যামিলি ডিভিশন' },
      // Welsh (cy)
      { docId: 'court_fam_01', code: 'family-court', locale: 'cy', name: 'Llys Teulu', desc: 'Llys Teulu Unedig Cymru a Lloegr ar gyfer achosion cyfraith breifat a chyhoeddus' },
      { docId: 'court_hc_02', code: 'high-court-family-division', locale: 'cy', name: 'Uchel Lys (Adran Teulu)', desc: 'Adran Teulu yr Uchel Lys ar gyfer achosion cymhleth a rhyngwladol' },
      // Spanish (es)
      { docId: 'court_fam_01', code: 'family-court', locale: 'es', name: 'Tribunal de Familia', desc: 'Tribunal de Familia de Inglaterra y Gales para asuntos de derecho público y privado' },
      { docId: 'court_hc_02', code: 'high-court-family-division', locale: 'es', name: 'Tribunal Superior (División de Familia)', desc: 'División de Familia del Tribunal Superior para procedimientos complejos e internacionales' },
      // Polish (pl)
      { docId: 'court_fam_01', code: 'family-court', locale: 'pl', name: 'Sąd Rodzinny', desc: 'Sąd Rodzinny Anglii i Walii orzekający w sprawach prawa prywatnego i publicznego' },
      { docId: 'court_hc_02', code: 'high-court-family-division', locale: 'pl', name: 'Wysoki Sąd (Wydział Rodzinny)', desc: 'Wydział Rodzinny Wysokiego Sądu dla skomplikowanych spraw międzynarodowych' },
    ];

    for (const c of courtTranslations) {
      await executeSql(ctx, `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM court_jurisdictions WHERE code = '${c.code}' AND locale = '${c.locale}') THEN
            INSERT INTO court_jurisdictions (document_id, name, code, description, "order", is_active, locale, created_at, updated_at, published_at)
            VALUES ('${c.docId}', '${c.name.replace(/'/g, "''")}', '${c.code}', '${c.desc.replace(/'/g, "''")}', 1, true, '${c.locale}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
          END IF;
        END $$;
      `);
    }

    // 4. Seed localized translations for Case Types
    const caseTypeTranslations = [
      // Hindi (hi)
      { docId: 'ctype_pub_01', code: 'public-law', locale: 'hi', name: 'सार्वजनिक कानून (देखभाल कार्यवाही)', desc: 'स्थानीय प्राधिकरण द्वारा बाल अधिनियम 1989 के तहत देखभाल की कार्यवाही' },
      { docId: 'ctype_priv_02', code: 'private-law', locale: 'hi', name: 'निजी कानून (बाल व्यवस्थाएं)', desc: 'बच्चों के रहने, मिलने और संपर्क से संबंधित माता-पिता के विवाद' },
      { docId: 'ctype_da_03', code: 'domestic-abuse', locale: 'hi', name: 'घरेलू हिंसा (गैर-उत्पीड़न व कब्जा आदेश)', desc: 'घरेलू दुर्व्यवहार, उत्पीड़न और सुरक्षा के लिए आवेदन' },
      { docId: 'ctype_fin_04', code: 'financial-remedies', locale: 'hi', name: 'वित्तीय उपाय एवं संपत्ति निपटान', desc: 'विवाह विच्छेद उपरांत संपत्ति, भरण-पोषण और पेंशन का वित्तीय समाधान' },
      { docId: 'ctype_adopt_05', code: 'adoption', locale: 'hi', name: 'दत्तक ग्रहण (अडॉपशन)', desc: 'बाल दत्तक ग्रहण एवं कानूनी अभिभावकता कार्यवाही' },
      { docId: 'ctype_oth_06', code: 'other', locale: 'hi', name: 'अन्य पारिवारिक कार्यवाही', desc: 'अन्य विविध पारिवारिक न्यायालय आवेदन' },

      // Bengali (bn)
      { docId: 'ctype_pub_01', code: 'public-law', locale: 'bn', name: 'পাবলিক আইন (যত্ন সংক্রান্ত কার্যক্রম)', desc: 'স্থানীয় কর্তৃপক্ষ দ্বারা শিশুদের সুরক্ষা ও যত্ন সংক্রান্ত আদালতের মামলা' },
      { docId: 'ctype_priv_02', code: 'private-law', locale: 'bn', name: 'ব্যক্তিগত আইন (সন্তানের হেফাজত ও ব্যবস্থা)', desc: 'সন্তানের সাথে বসবাস ও যোগাযোগের অধিকার সংক্রান্ত বিরোধ' },
      { docId: 'ctype_da_03', code: 'domestic-abuse', locale: 'bn', name: 'পারিবারিক সহিংসতা ও সুরক্ষা আদেশ', desc: 'শারীরিক ও মানসিক নির্যাতন থেকে সুরক্ষা এবং বাড়ি থেকে বহিষ্কার আদেশ' },
      { docId: 'ctype_fin_04', code: 'financial-remedies', locale: 'bn', name: 'আর্থিক প্রতিকার ও সম্পত্তি বণ্টন', desc: 'বিবাহ বিচ্ছেদের পর খোরপোশ ও যৌথ সম্পত্তি বণ্টন সংক্রান্ত প্রতিকার' },
      { docId: 'ctype_adopt_05', code: 'adoption', locale: 'bn', name: 'দত্তক গ্রহণ (অ্যাডপশন)', desc: 'শিশুকে বৈধভাবে দত্তক নেওয়া সংক্রান্ত কার্যক্রম' },
      { docId: 'ctype_oth_06', code: 'other', locale: 'bn', name: 'অন্যান্য পারিবারিক মামলা', desc: 'অন্যান্য সকল প্রকার পারিবারিক আদালত আবেদন' },

      // Welsh (cy)
      { docId: 'ctype_pub_01', code: 'public-law', locale: 'cy', name: 'Cyfraith Gyhoeddus (Achosion Gofal)', desc: 'Achosion gofal awdurdod lleol o dan Ran IV Deddf Plant 1989' },
      { docId: 'ctype_priv_02', code: 'private-law', locale: 'cy', name: 'Cyfraith Breifat (Trefniadau Plant)', desc: 'Anghydfodau rhieni ynghylch preswylio a chyswllt plant' },
      { docId: 'ctype_da_03', code: 'domestic-abuse', locale: 'cy', name: 'Cam-drin Domestig (Gorchmynion Di-Aflonyddu)', desc: 'Amddiffyn rhag trais domestig ac aflonyddu' },
      { docId: 'ctype_fin_04', code: 'financial-remedies', locale: 'cy', name: 'Rhwymedïau Ariannol', desc: 'Rhaniad asedau, cynhaliaeth a phensiynau yn ystod ysgariad' },
      { docId: 'ctype_adopt_05', code: 'adoption', locale: 'cy', name: 'Mabwysiadu', desc: 'Gorchmynion mabwysiadu plentyn' },
      { docId: 'ctype_oth_06', code: 'other', locale: 'cy', name: 'Achosion Teulu Eraill', desc: 'Ceisiadau cyffredinol eraill y Llys Teulu' },

      // Spanish (es)
      { docId: 'ctype_pub_01', code: 'public-law', locale: 'es', name: 'Derecho Público (Procedimientos de Cuidado)', desc: 'Procedimientos de tutela y protección de menores por parte de autoridades locales' },
      { docId: 'ctype_priv_02', code: 'private-law', locale: 'es', name: 'Derecho Privado (Acuerdos sobre Menores)', desc: 'Disputas parentales sobre custodia, régimen de visitas y contacto con menores' },
      { docId: 'ctype_da_03', code: 'domestic-abuse', locale: 'es', name: 'Violencia Doméstica (Órdenes de Alejamiento)', desc: 'Protección judicial urgente frente al acoso y violencia intrafamiliar' },
      { docId: 'ctype_fin_04', code: 'financial-remedies', locale: 'es', name: 'Medidas Económicas y Compensación', desc: 'Liquidación económica, pensiones alimenticias y reparto patrimonial' },
      { docId: 'ctype_adopt_05', code: 'adoption', locale: 'es', name: 'Adopción', desc: 'Procedimientos de adopción y tutela legal permanente' },
      { docId: 'ctype_oth_06', code: 'other', locale: 'es', name: 'Otros Asuntos de Familia', desc: 'Otros procedimientos y solicitudes ante el Tribunal de Familia' },

      // Polish (pl)
      { docId: 'ctype_pub_01', code: 'public-law', locale: 'pl', name: 'Prawo Publiczne (Postępowanie Opiekuńcze)', desc: 'Sprawy o objęcie opieką i nadzorem władz lokalnych' },
      { docId: 'ctype_priv_02', code: 'private-law', locale: 'pl', name: 'Prawo Prywatne (Ustalenia Dotyczące Dzieci)', desc: 'Ustalenia miejsca pobytu dzieci oraz kontaktów rodzicielskich' },
      { docId: 'ctype_da_03', code: 'domestic-abuse', locale: 'pl', name: 'Przemoc Domowa (Zakaz Zbliżania i Naruszania Spokoju)', desc: 'Ochrona przed przemocą domową oraz nakazy opuszczenia lokalu' },
      { docId: 'ctype_fin_04', code: 'financial-remedies', locale: 'pl', name: 'Roszczenia Finansowe i Podział Majątku', desc: 'Alimenty, podział majątku małżeńskiego oraz emerytur' },
      { docId: 'ctype_adopt_05', code: 'adoption', locale: 'pl', name: 'Adopcja', desc: 'Postępowanie w sprawie przysposobienia dziecka' },
      { docId: 'ctype_oth_06', code: 'other', locale: 'pl', name: 'Inne Sprawy Rodzinne', desc: 'Pozostałe wnioski przed Sądem Rodzinnym' },
    ];

    for (const ct of caseTypeTranslations) {
      await executeSql(ctx, `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM case_types WHERE code = '${ct.code}' AND locale = '${ct.locale}') THEN
            INSERT INTO case_types (document_id, name, code, description, "order", is_active, locale, created_at, updated_at, published_at)
            VALUES ('${ct.docId}', '${ct.name.replace(/'/g, "''")}', '${ct.code}', '${ct.desc.replace(/'/g, "''")}', 1, true, '${ct.locale}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
          END IF;
        END $$;
      `);
    }

    // 5. Seed localized translations for Case Quick Presets
    const presetTranslations = [
      // Hindi (hi)
      { docId: 'preset_ca_01', key: 'child-arrangements', locale: 'hi', label: 'बाल व्यवस्था (संपर्क / निवास)', title: 'बाल व्यवस्था आवेदन (साथ रहना / मिलना-जुलना)', desc: 'बच्चों का निवास, सप्ताहांत संपर्क और छुट्टियों की व्यवस्था' },
      { docId: 'preset_pso_02', key: 'prohibited-steps', locale: 'hi', label: 'निषेधात्मक कदम आदेश', title: 'निषेधात्मक कदम / विशिष्ट मुद्दे का आदेश आवेदन', desc: 'स्कूल, विदेश यात्रा या चिकित्सा निर्णयों पर रोक' },
      { docId: 'preset_nonmol_03', key: 'non-molestation', locale: 'hi', label: 'गैर-उत्पीड़न आदेश', title: 'गैर-उत्पीड़न एवं आवास सुरक्षा आदेश आवेदन', desc: 'उत्पीड़न, धमकी और दुर्व्यवहार से त्वरित कानूनी सुरक्षा' },
      { docId: 'preset_fin_04', key: 'financial-remedy', locale: 'hi', label: 'वित्तीय समाधान (फॉर्म ए)', title: 'वित्तीय उपाय एवं परिसंपत्ति विभाजन कार्यवाही', desc: 'भरण-पोषण, मकान व पेंशन अधिकारों का निपटारा' },
      { docId: 'preset_care_05', key: 'care-proceedings', locale: 'hi', label: 'देखभाल / पर्यवेक्षण आदेश', title: 'धारा 31 बाल अधिनियम के तहत देखभाल कार्यवाही', desc: 'स्थानीय निकाय की बाल देखभाल व पर्यवेक्षण आदेश प्रक्रिया' },

      // Bengali (bn)
      { docId: 'preset_ca_01', key: 'child-arrangements', locale: 'bn', label: 'সন্তানের ব্যবস্থা (হেফাজত/যোগাযোগ)', title: 'সন্তানের ব্যবস্থা সংক্রান্ত আবেদন (বসবাস / দেখা-সাক্ষাৎ)', desc: 'সন্তানের সাথে বসবাস, ছুটির দিনের যোগাযোগ ও হেফাজতের ব্যবস্থা' },
      { docId: 'preset_pso_02', key: 'prohibited-steps', locale: 'bn', label: 'নিষিদ্ধকরণ পদক্ষেপ আদেশ (PSO)', title: 'নিষিদ্ধকরণ পদক্ষেপ বা নির্দিষ্ট ইস্যু সংক্রান্ত আদেশ', desc: 'স্কুল পরিবর্তন, বিদেশে নিয়ে যাওয়া বা চিকিৎসা সিদ্ধান্তের উপর নিষেধাজ্ঞা' },
      { docId: 'preset_nonmol_03', key: 'non-molestation', locale: 'bn', label: 'নির্যাতন নিরোধ আদেশ', title: 'নির্যাতন নিরোধ ও বাসস্থান সুরক্ষা আদেশ আবেদন', desc: 'হয়রানি, সহিংসতা ও হুমকি থেকে আদালতের দ্রুত সুরক্ষা' },
      { docId: 'preset_fin_04', key: 'financial-remedy', locale: 'bn', label: 'আর্থিক প্রতিকার (ফর্ম এ)', title: 'বিবাহ বিচ্ছেদ পরবর্তী আর্থিক সমাধান আবেদন', desc: 'খোরপোশ, পারিবারিক বাড়ি ও পেনশনের আর্থিক নিষ্পত্তি' },
      { docId: 'preset_care_05', key: 'care-proceedings', locale: 'bn', label: 'যত্ন ও তত্ত্বাবধান কার্যক্রম', title: 'চিলড্রেন অ্যাক্ট ধারা ৩১ এর আওতায় যত্ন কার্যক্রম', desc: 'স্থানীয় কর্তৃপক্ষের তত্ত্বাবধানে শিশুদের নিরাপত্তা কার্যক্রম' },

      // Welsh (cy)
      { docId: 'preset_ca_01', key: 'child-arrangements', locale: 'cy', label: 'Trefniadau Plant', title: 'Cais am Drefniadau Plant (Byw Gyda / Cyswllt)', desc: 'Preswylfa, cyswllt rheolaidd a gwyliau' },
      { docId: 'preset_pso_02', key: 'prohibited-steps', locale: 'cy', label: 'Gorchymyn Camau Gwaharddedig', title: 'Cais am Orchymyn Camau Gwaharddedig / Mater Penodol', desc: 'Ysgol, adleoli neu benderfyniadau meddygol' },
      { docId: 'preset_nonmol_03', key: 'non-molestation', locale: 'cy', label: 'Gorchymyn Di-Aflonyddu', title: 'Cais am Orchymyn Di-Aflonyddu a Meddiannaeth', desc: 'Amddiffyniad rhag cam-drin domestig ac aflonyddu' },
      { docId: 'preset_fin_04', key: 'financial-remedy', locale: 'cy', label: 'Rhwymedïau Ariannol', title: 'Achosion Rhwymedi Ariannol (Ffurflen A)', desc: 'Cynhaliaeth, addasu eiddo a phensiynau' },
      { docId: 'preset_care_05', key: 'care-proceedings', locale: 'cy', label: 'Gofal / Goruchwyliaeth', title: 'Achosion Cyfraith Gyhoeddus dan Adran 31', desc: 'Gorchmynion gofal neu oruchwyliaeth awdurdod lleol' },

      // Spanish (es)
      { docId: 'preset_ca_01', key: 'child-arrangements', locale: 'es', label: 'Acuerdos sobre Menores', title: 'Solicitud de Acuerdos sobre Menores (Custodia / Visitas)', desc: 'Residencia habitual, visitas de fin de semana y vacaciones' },
      { docId: 'preset_pso_02', key: 'prohibited-steps', locale: 'es', label: 'Orden de Medidas Prohibitorias', title: 'Solicitud de Medidas Prohibitorias / Cuestión Específica', desc: 'Decisiones educativas, traslados internacionales o tratamientos médicos' },
      { docId: 'preset_nonmol_03', key: 'non-molestation', locale: 'es', label: 'Orden de Alejamiento', title: 'Solicitud de Orden de Alejamiento y Protección del Hogar', desc: 'Protección judicial ante acoso, amenazas y agresiones' },
      { docId: 'preset_fin_04', key: 'financial-remedy', locale: 'es', label: 'Medidas Económicas (Form A)', title: 'Procedimiento de Compensación Económica y Alimentos', desc: 'Pensión compensatoria, atribución de vivienda y derechos de pensión' },
      { docId: 'preset_care_05', key: 'care-proceedings', locale: 'es', label: 'Procedimiento de Tutela / Custodia Pública', title: 'Procedimiento Público bajo Sección 31 Ley del Menor', desc: 'Órdenes de tutela o acogimiento de la autoridad local' },

      // Polish (pl)
      { docId: 'preset_ca_01', key: 'child-arrangements', locale: 'pl', label: 'Ustalenia Dotyczące Dzieci', title: 'Wniosek o Ustalenia Opiekuńcze (Pobyt / Kontakty)', desc: 'Miejsce zamieszkania, kontakty w weekendy i wakacje' },
      { docId: 'preset_pso_02', key: 'prohibited-steps', locale: 'pl', label: 'Zakaz Określonych Czynności (PSO)', title: 'Wniosek o Zakaz Określonych Czynności / Rozstrzygnięcie Istotnych Spraw Dziecka', desc: 'Wybór szkoły, wyjazd za granicę i zabiegi medyczne' },
      { docId: 'preset_nonmol_03', key: 'non-molestation', locale: 'pl', label: 'Zakaz Zbliżania i Nękania', title: 'Wniosek o Zakaz Naruszania Spokoju i Ochronę Mieszkania', desc: 'Natychmiastowa ochrona przed przemocą i nękaniem' },
      { docId: 'preset_fin_04', key: 'financial-remedy', locale: 'pl', label: 'Roszczenia Finansowe (Formularz A)', title: 'Postępowanie o Podział Majątku i Alimenty', desc: 'Alimenty na małżonka, podział domu i kapitału emerytalnego' },
      { docId: 'preset_care_05', key: 'care-proceedings', locale: 'pl', label: 'Nadzór Opiekuńczy / Piecza', title: 'Postępowanie Opiekuńcze na podstawie Sekcji 31', desc: 'Zarządzenia opiekuńcze lub nadzorcze władz lokalnych' },
    ];

    for (const p of presetTranslations) {
      await executeSql(ctx, `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM case_presets WHERE preset_key = '${p.key}' AND locale = '${p.locale}') THEN
            INSERT INTO case_presets (document_id, preset_key, label, title_template, case_type, court, icon, description, "order", is_active, locale, created_at, updated_at, published_at)
            VALUES ('${p.docId}', '${p.key}', '${p.label.replace(/'/g, "''")}', '${p.title.replace(/'/g, "''")}', 'Private Law', 'Family Court', 'file', '${p.desc.replace(/'/g, "''")}', 1, true, '${p.locale}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
          END IF;
        END $$;
      `);
    }
  },

  /**
   * Rollback migration
   */
  async down(ctx) {
    // Delete seeded localized translations
    await executeSql(ctx, `
      DELETE FROM court_jurisdictions WHERE locale IN ('bn', 'es', 'pl', 'pa', 'ur', 'hi', 'cy');
      DELETE FROM case_types WHERE locale IN ('bn', 'es', 'pl', 'pa', 'ur', 'hi', 'cy');
      DELETE FROM case_presets WHERE locale IN ('bn', 'es', 'pl', 'pa', 'ur', 'hi', 'cy');
      DELETE FROM i18n_locale WHERE code IN ('bn', 'es', 'pl', 'pa', 'ur');
    `);
  },
};
