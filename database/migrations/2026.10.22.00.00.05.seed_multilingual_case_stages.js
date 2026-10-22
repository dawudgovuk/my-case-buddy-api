/**
 * Migration: 2026.10.22.00.00.05.seed_multilingual_case_stages.js
 * Description: Seeds translated case stages for Hindi (hi), Bengali (bn), Welsh (cy),
 *              Spanish (es), and Polish (pl), and links each stage to the corresponding
 *              localized case_type record in case_stages_case_type_lnk.
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

const STAGE_TRANSLATIONS = {
  hi: {
    'application': { name: 'आवेदन दाखिल', desc: 'अदालत में आवेदन औपचारिक रूप से दाखिल किया गया' },
    'first-hearing': { name: 'प्रथम सुनवाई (FHDRA / CMH)', desc: 'केस प्रबंधन या प्रारंभिक समीक्षा सुनवाई' },
    'pre-proceedings': { name: 'पूर्व-कार्यवाही मूल्यांकन', desc: 'प्रारंभिक मूल्यांकन एवं आधिकारिक बैठकें' },
    'directions': { name: 'दिशा-निर्देश सुनवाई', desc: 'अंतरिम आदेश एवं प्रक्रियात्मक निर्देश जारी' },
    'fact-finding': { name: 'तथ्य-खोज सुनवाई', desc: 'विवादित तथ्यों और आरोपों की सत्यता पर सुनवाई' },
    'welfare': { name: 'बाल कल्याण सुनवाई', desc: 'बाल कल्याण रिपोर्ट एवं अनुसंशाओं का मूल्यांकन' },
    'final': { name: 'अंतिम आदेश एवं निर्णय', desc: 'अंतिम कानूनी निर्णय एवं आदेश जारी' },
    'mediation': { name: 'मध्यस्थता / मूल्यांकन', desc: 'पारिवारिक मध्यस्थता या मूल्यांकन प्रक्रिया' },
    'without-notice': { name: 'बिना नोटिस त्वरित सुनवाई', desc: 'अत्यावश्यक एकतरफा सुरक्षा सुनवाई' },
    'service': { name: 'दस्तावेज़ तामील (Service)', desc: 'प्रतिवादी को कानूनी नोटिस और आवेदन की तामील' },
    'return-hearing': { name: 'वापसी सुनवाई (Return Hearing)', desc: 'दोनों पक्षों की उपस्थिति में सुनवाई' },
    'first-appointment': { name: 'प्रथम नियुक्ति (FDA)', desc: 'वित्तीय विवादों के लिए प्रथम दिशा-निर्देश नियुक्ति' },
    'disclosure': { name: 'वित्तीय प्रकटीकरण', desc: 'परिसंपत्तियों एवं आय का पूर्ण प्रकटीकरण' },
    'fdr': { name: 'वित्तीय विवाद समाधान (FDR)', desc: 'न्यायाधीश के समक्ष वित्तीय समाधान वार्ता' },
    'assessment': { name: 'दत्तक मूल्यांकन', desc: 'सामाजिक कार्यकर्ता एवं दत्तक एजेंसी मूल्यांकन' },
  },
  bn: {
    'application': { name: 'আবেদন দাখিল', desc: 'আদালতে আনুষ্ঠানিকভাবে আবেদনপত্র জমা দেওয়া হয়েছে' },
    'first-hearing': { name: 'প্রথম শুনানি (FHDRA / CMH)', desc: 'মামলা পরিচালনা ও প্রাথমিক পর্যালোচনা শুনানি' },
    'pre-proceedings': { name: 'কার্যধারা পূর্ববর্তী প্রক্রিয়া', desc: 'মূল্যায়ন ও প্রাক-কার্যধারা বৈঠকসমূহ' },
    'directions': { name: 'নির্দেশনামূলক শুনানি (Directions)', desc: 'অন্তর্বর্তীকালীন আদেশ ও পরবর্তী পদক্ষেপের নির্দেশনা' },
    'fact-finding': { name: 'তথ্য অনুসন্ধান শুনানি', desc: 'অভিযোগ ও বিতর্কিত তথ্যের সত্যতা যাচাই' },
    'welfare': { name: 'কল্যাণমূলক শুনানি (Welfare)', desc: 'সন্তানের সর্বোত্তম কল্যাণ ও মূল্যায়ন' },
    'final': { name: 'চূড়ান্ত আদেশ ও নিষ্পত্তি', desc: 'আদালতের চূড়ান্ত রায় ও আনুষ্ঠানিক আদেশ' },
    'mediation': { name: 'পারিবারিক মধ্যস্থতা', desc: 'আপস-মীমাংসা ও মধ্যস্থতা প্রক্রিয়া' },
    'without-notice': { name: 'জরুরি একতরফা শুনানি', desc: 'প্রতিপক্ষকে নোটিশ ছাড়াই জরুরি সুরক্ষা শুনানি' },
    'service': { name: 'নোটিশ জারি ও পরিবেশন (Service)', desc: 'প্রতিপক্ষের কাছে আইনি নোটিশ পৌঁছে দেওয়া' },
    'return-hearing': { name: 'উভয়পক্ষের পুনর্বার শুনানি', desc: 'উভয়পক্ষের উপস্থিতিতে অন্তর্বর্তী আদেশ পর্যালোচনা' },
    'first-appointment': { name: 'প্রথম আর্থিক অ্যাপয়েন্টমেন্ট (FDA)', desc: 'সম্পত্তি ও আর্থিক দাবির প্রাথমিক নির্দেশনা' },
    'disclosure': { name: 'আর্থিক প্রকাশ ও হিসাব বিবরণী', desc: 'উভয়পক্ষের সম্পূর্ণ আর্থিক তথ্য প্রকাশ' },
    'fdr': { name: 'আর্থিক বিরোধ নিষ্পত্তি (FDR)', desc: 'আপসের মাধ্যমে আর্থিক বিরোধ সমাধান শুনানি' },
    'assessment': { name: 'দত্তক মূল্যায়ন প্রতিবেদন', desc: 'দত্তক গ্রহণের সক্ষমতা ও যাচাইকরণ প্রতিবেদন' },
  },
  cy: {
    'application': { name: 'Cais wedi\'i Ffeilio', desc: 'Cais wedi\'i gyflwyno\'n ffurfiol i\'r llys' },
    'first-hearing': { name: 'Gwrandawiad Cyntaf (FHDRA / CMH)', desc: 'Gwrandawiad rheoli achos a datrys anghydfod cyntaf' },
    'pre-proceedings': { name: 'Cyfnod Cyn-achosion', desc: 'Asesiadau a chyfarfodydd cyn-achosion' },
    'directions': { name: 'Cyfarwyddiadau', desc: 'Gwrandawiad cyfarwyddiadau a gorchmynion dros dro' },
    'fact-finding': { name: 'Canfod Ffeithiau', desc: 'Gwrandawiad i ganfod ffeithiau a honiadau' },
    'welfare': { name: 'Gwrandawiad Lles', desc: 'Asesiad lles a gwrandawiad lles' },
    'final': { name: 'Gorchymyn Terfynol', desc: 'Dyfarniad a gorchymyn terfynol y llys' },
    'mediation': { name: 'Cyfryngu / Asesu', desc: 'Proses cyfryngu teulu neu asesu' },
    'without-notice': { name: 'Gwrandawiad Heb Rybudd', desc: 'Gwrandawiad brys heb rybudd i\'r atebydd' },
    'service': { name: 'Gwasanaethu Dogfennau', desc: 'Gwasanaethu\'r cais ar yr atebydd' },
    'return-hearing': { name: 'Gwrandawiad Dychwelyd', desc: 'Gwrandawiad dychwelyd gyda\'r ddwy ochr' },
    'first-appointment': { name: 'Apwyntiad Cyntaf (FDA)', desc: 'Apwyntiad cyfarwyddiadau ariannol cyntaf' },
    'disclosure': { name: 'Datgeliad Ariannol', desc: 'Proses datgelu asedau ac incwm' },
    'fdr': { name: 'Datrys Anghydfod Ariannol (FDR)', desc: 'Gwrandawiad cymodi a datrys anghydfod ariannol' },
    'assessment': { name: 'Asesiad Mabwysiadu', desc: 'Asesiadau ac adroddiadau mabwysiadu' },
  },
  es: {
    'application': { name: 'Solicitud Presentada', desc: 'Solicitud formal registrada ante el tribunal' },
    'first-hearing': { name: 'Primera Audiencia (FHDRA / CMH)', desc: 'Audiencia preliminar de resolución de disputas' },
    'pre-proceedings': { name: 'Fase Previa al Proceso', desc: 'Evaluaciones y reuniones previas a la incoación' },
    'directions': { name: 'Instrucciones Procesales', desc: 'Audiencia de directrices y medidas provisionales' },
    'fact-finding': { name: 'Esclarecimiento de Hechos', desc: 'Audiencia probatoria sobre hechos controvertidos' },
    'welfare': { name: 'Audiencia de Bienestar del Menor', desc: 'Evaluación del informe pericial y bienestar del menor' },
    'final': { name: 'Resolución y Orden Final', desc: 'Sentencia y orden judicial definitiva' },
    'mediation': { name: 'Mediación y Evaluación', desc: 'Proceso de mediación familiar o peritaje' },
    'without-notice': { name: 'Audiencia Urgente Sin Previo Aviso', desc: 'Audiencia inaudita parte por razones de urgencia' },
    'service': { name: 'Notificación Judicial', desc: 'Emplazamiento y traslado de la demanda a la parte demandada' },
    'return-hearing': { name: 'Audiencia de Ratificación', desc: 'Vista contradictoria con asistencia de ambas partes' },
    'first-appointment': { name: 'Primera Comparecencia (FDA)', desc: 'Primera cita de directrices patrimoniales' },
    'disclosure': { name: 'Régimen de Transparencia Financiera', desc: 'Aportación y examen documental de ingresos y patrimonio' },
    'fdr': { name: 'Resolución de Disputas Financieras (FDR)', desc: 'Audiencia conciliatoria de mediación patrimonial judicial' },
    'assessment': { name: 'Evaluación de Idoneidad', desc: 'Dictamen pericial y valoración psicosocial de adopción' },
  },
  pl: {
    'application': { name: 'Wniosek Złożony', desc: 'Wniosek formalnie zarejestrowany w sądzie' },
    'first-hearing': { name: 'Pierwsze Posiedzenie (FHDRA / CMH)', desc: 'Wstępne posiedzenie organizacyjne i mediacyjne' },
    'pre-proceedings': { name: 'Postępowanie Przygotowawcze', desc: 'Spotkania wstępne i ocena opiekuńcza' },
    'directions': { name: 'Wydanie Zarządzeń', desc: 'Posiedzenie w przedmiocie zarządzeń tymczasowych' },
    'fact-finding': { name: 'Ustalenie Stanu Faktycznego', desc: 'Posiedzenie dowodowe w przedmiocie spornych okoliczności' },
    'welfare': { name: 'Ocena Dobra Dziecka (Welfare)', desc: 'Analiza opinii biegłych i dobrostanu dziecka' },
    'final': { name: 'Orzeczenie Końcowe', desc: 'Wydanie prawomocnego orzeczenia kończącego sprawę' },
    'mediation': { name: 'Mediacja / Postępowanie Rozjemcze', desc: 'Procedura mediacji rodzinnej i ugodowej' },
    'without-notice': { name: 'Posiedzenie Pilne Bez Zawiadomienia', desc: 'Rozpoznanie wniosku w trybie natychmiastowym' },
    'service': { name: 'Doręczenie Pism Sądowych', desc: 'Doręczenie odpisu wniosku stronie przeciwnej' },
    'return-hearing': { name: 'Posiedzenie z Udziałem Stron', desc: 'Weryfikacja zarządzeń tymczasowych z udziałem stron' },
    'first-appointment': { name: 'Pierwsze Posiedzenie Majątkowe (FDA)', desc: 'Określenie kierunków postępowania finansowego' },
    'disclosure': { name: 'Ujawnienie Majątku i Dochodów', desc: 'Wymiana dokumentacji finansowej i wykazów majątku' },
    'fdr': { name: 'Sądowe Posiedzenie Pojednawcze (FDR)', desc: 'Posiedzenie ukierunkowane na ugodę majątkową' },
    'assessment': { name: 'Kwalifikacja Adopcyjna', desc: 'Ocena predyspozycji i raport kwalifikacyjny' },
  },
};

module.exports = {
  /**
   * Apply migration
   */
  async up(ctx) {
    // 1. Fetch all existing English case stages
    const enStagesResult = await executeSql(ctx, `
      SELECT id, document_id, key, name, description, "order", case_type_code 
      FROM case_stages 
      WHERE locale = 'en'
      ORDER BY id ASC;
    `);

    const enStages = enStagesResult.rows || [];
    const targetLocales = ['hi', 'bn', 'cy', 'es', 'pl'];

    for (const locale of targetLocales) {
      const dict = STAGE_TRANSLATIONS[locale] || {};

      for (const enStage of enStages) {
        const trans = dict[enStage.key] || { name: enStage.name, desc: enStage.description };
        const safeName = trans.name.replace(/'/g, "''");
        const safeDesc = (trans.desc || '').replace(/'/g, "''");
        const docId = enStage.document_id;
        const key = enStage.key;
        const order = enStage.order || 1;
        const caseTypeCode = enStage.case_type_code;

        // Insert localized stage if not already existing
        const insertRes = await executeSql(ctx, `
          DO $$
          DECLARE
            new_stage_id INT;
            target_case_type_id INT;
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM case_stages 
              WHERE document_id = '${docId}' AND locale = '${locale}'
            ) THEN
              INSERT INTO case_stages (
                document_id, key, name, description, "order", case_type_code, is_active, locale, created_at, updated_at, published_at
              ) VALUES (
                '${docId}', '${key}', '${safeName}', '${safeDesc}', ${order}, '${caseTypeCode}', true, '${locale}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              ) RETURNING id INTO new_stage_id;

              -- Find corresponding localized case_type_id
              SELECT id INTO target_case_type_id 
              FROM case_types 
              WHERE code = '${caseTypeCode}' AND locale = '${locale}' 
              LIMIT 1;

              IF target_case_type_id IS NOT NULL AND new_stage_id IS NOT NULL THEN
                INSERT INTO case_stages_case_type_lnk (case_stage_id, case_type_id, case_stage_ord)
                VALUES (new_stage_id, target_case_type_id, ${order});
              END IF;
            END IF;
          END $$;
        `);
      }
    }
  },

  /**
   * Rollback migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DELETE FROM case_stages_case_type_lnk 
      WHERE case_stage_id IN (
        SELECT id FROM case_stages WHERE locale IN ('hi', 'bn', 'cy', 'es', 'pl')
      );

      DELETE FROM case_stages WHERE locale IN ('hi', 'bn', 'cy', 'es', 'pl');
    `);
  },
};
