# Letter to Ajuntament de Barcelona — RESCCUE street flooding licence

Status: draft, not sent. Related: `docs/DATA_LICENSES.md` section 5.2, `docs/features/067-licence-followups.md`.

## How to send this letter

Send **one message** to the three main recipients, with CETAQUA in copy. Only the CETAQUA address is confirmed on
its own site; the others come from third-party pages (see the note next to each address).

### Step 1. Before you send

1. Make sure the site is live at the address in the letter, and that the street-flooding layer and its "no explicit
   licence" notice are visible on it.
2. Fill in your name and contact email at the end of the letter (they are not stored in the repo).
3. The letter says the tool is free. Change that sentence if it is no longer true.

### Step 2. Where to send it

Addresses were searched on 2026-11-14. The Ajuntament publishes no email for its departments, only web forms, so
the two municipal recipients get the text through a form, and BCASA and CETAQUA get an email.

Main recipients (the letter goes to all three):

1. **Open Data BCN / Oficina Municipal de Dades** (Ajuntament de Barcelona).
   - Form linked from the portal's "Contact us": http://www.bcn.cat/cgi-bin/consultesIRIS?id=241
   - Head of the office per the municipal organigrama: Màrius Boada Pla, director; Avinyó 32, 08002 Barcelona;
     tel. 93 256 53 93.
   - No email is published. `opendata@bcn.cat` was not found anywhere; do not use it. An old address,
     `barcelonadadesobertes@bcn.cat`, appears in a 2017 press release and may be dead.
2. **Departament de Resiliència Urbana**, Àrea d'Ecologia Urbana (publisher of the Atles de resiliència).
   - Form, "Atenció en línia", category *Medi ambient*:
     https://atencioenlinia.ajuntament.barcelona.cat/ca/fitxa/resultat-busqueda?category=29
     (this is what the "Contacte" link in the footer of the Atles page leads to).
   - Direct address of the head of the department, Ares Gabàs Masip: `agabasm@bcn.cat`. Found only in a
     third-party listing (La Salle URL staff directory), undated, so it may be out of date. Worth adding as a
     recipient of the email below, because a form message may never reach the department.

3. **Barcelona Cicle de l'Aigua SA (BCASA)**, author of the PDISBA'19 model and the likely rights holder: the
   PDISBA record in BCNROC names BCASA as author, under CC BY-NC-ND.
   - `info.bcasa@bcn.cat`. Seen in search results (municipal directory entry and a BCASA annual report); it is not
     shown on the current BCASA site, so confirm by phone if it bounces.
   - Tel. 93 289 68 00; Carrer Acer 16, 3a planta, 08038 Barcelona. Director: Alejandro Ortiz Garre.

In copy, by email:

4. **CETAQUA**, owner of the toolkit.resccue.eu site and its content (stated in the site's legal notice).
   - `info@cetaqua.com` (confirmed on cetaqua.com/en/contact). Tel. 933 124 800.
   - Ctra. d'Esplugues 75, 08940 Cornellà de Llobregat.

Optional, if the others do not answer:

5. **Aquatec** (RESCCUE coordinator; project contact Marc Velasco): `proyectos@aquatec.es`, taken from a partner
   page, not confirmed.
6. **Beniamino Russo**, first author of the paper on the Barcelona flood model (Sustainability 2020, 12, 5638):
   `brusso@unizar.es`, taken from a copy of the paper, not confirmed.

How to send it in practice: one email to `info.bcasa@bcn.cat` and `agabasm@bcn.cat` with `info@cetaqua.com` in
copy, and the same text through the two municipal forms (1 and 2), saying in the form that the email was also sent.

### Step 3. Send

Use the subject and the Catalan text below.

### Step 4. After a reply

- Keep the reply with the project records.
- If reuse is allowed, update `docs/DATA_LICENSES.md` (section 5.2, row 2 of the risk table), the legend and the dialog
  in `frontend/src/services/dataSources.ts`, and the feature file `docs/features/067-licence-followups.md`.

## Subject

Sol·licitud de llicència de reutilització de les dades d'inundació urbana (RESCCUE, Atles de resiliència)

## Text (Catalan)

Bon dia,

Escric en relació amb la capa «Alçària d'aigua en superfície» (T-10 i T-100, escenari actual) de l'Atles de resiliència de la ciutat de Barcelona (https://coneixement-eu.bcn.cat/widget/atles-resiliencia/index_resccue_inun_urbana.html), la font de la qual s'indica com «PDISBA'19 (BCASA) – RESCCUE Project». Us demano permís per reutilitzar aquesta capa en una eina web gratuïta, i saber amb quina llicència ho puc fer.

Adreço aquest missatge a l'Oficina Municipal de Dades, al Departament de Resiliència Urbana i a BCASA, amb còpia a CETAQUA, perquè no he pogut determinar qui és el titular dels drets.

Estic desenvolupant una eina web gratuïta per ajudar les persones a triar on viure a Barcelona i a l'àrea metropolitana, a partir de dades obertes (soroll, inundabilitat fluvial, risc d'incendi, transport, serveis). L'eina està disponible a https://livability.time2map.com/. Mostra, per a cada edifici, el risc d'inundació i permet a la persona usuària donar-li més o menys pes en la valoració del lloc.

Voldria utilitzar la capa d'inundació urbana de l'Atles amb aquest fi: el calat de l'aigua als carrers (classes de profunditat per a T-10 i T-100) es dibuixa sobre el mapa i s'assigna a cada edifici segons el carrer on té la porta. La font s'esmenta de forma visible a l'eina, i la llicència de la capa s'hi indica tal com es mostra avui: sense llicència explícita.

He revisat les condicions que hi ha publicades i no he trobat una llicència per a aquesta capa:

- La pàgina de la capa no indica cap règim de reutilització ni enllaç a Open Data BCN. En canvi, les altres 23 capes de l'Atles que hi ha a Open Data BCN estan publicades amb llicència CC BY 4.0.
- L'Avís legal de l'Ajuntament permet reutilitzar les dades difoses al web citant la font, sense alterar-ne el contingut, però diu també que, quan no s'especifica cap règim, es consideren reservats tots els drets i que no es pot reutilitzar el material de tercers. No tinc clar si això cobreix aquesta capa, que ha estat elaborada per BCASA en el marc del projecte RESCCUE.
- El Pla de gestió de dades del projecte RESCCUE (lliurable D8.6) preveu publicar les simulacions de drenatge urbà de Barcelona (Aquatec, BCASA) a INSPIRE i Zenodo amb «la reutilització més àmplia possible», però no he trobat aquest conjunt de dades publicat enlloc, ni amb llicència.
- El document del PDISBA publicat al repositori BCNROC (http://hdl.handle.net/11703/119275, autor: Barcelona Cicle de l'Aigua, S.A.) porta la llicència CC BY-NC-ND. No sé si aquesta llicència s'aplica també a la capa de l'Atles.

Per això us demano, si us sembla bé:

1. Que confirmeu per escrit que puc reutilitzar la capa (classes de profunditat T-10 i T-100, escenari actual) citant-ne la font, i amb quina llicència (idealment CC BY 4.0).
2. Que m'indiqueu si aquest permís inclou la transformació de les dades (conversió a tessel·les vectorials i càlcul d'un indicador per edifici) i, en aquest cas, l'ús comercial, per si l'eina evoluciona cap a un servei de pagament.
3. Que valoreu publicar la capa a Open Data BCN sota CC BY 4.0, com la resta de l'Atles, perquè pugui reutilitzar-la qualsevol persona.
4. Que m'indiqueu com voleu que se citi la font (text i enllaç) i qui és el titular dels drets (Ajuntament, BCASA, Aquatec o CETAQUA), per adreçar-me a qui correspongui.

Fins que rebi resposta, la capa es mostra amb l'avís que no té llicència explícita, i puc desactivar-la si ho preferiu. Quedo a la vostra disposició per ampliar qualsevol detall tècnic.

Gràcies per la vostra atenció,

[Nom i cognoms]
[Correu electrònic]
https://livability.time2map.com/

---
