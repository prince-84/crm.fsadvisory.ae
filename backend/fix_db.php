<?php
$mapPath = 'd:\FSadvisory-crm\whatsapp-gateway\contacts_map.json';
$map = json_decode(file_get_contents($mapPath), true);
$chats = DB::table('whatsapp_chats')->get();
foreach($chats as $c) {
    if (str_contains($c->remote_jid, '@lid')) {
        $cleanLid = str_replace('@lid', '', $c->remote_jid);
        $realPhone = $map['phoneMap'][$c->remote_jid] ?? $map['phoneMap'][$cleanLid] ?? null;
        $newPhone = $realPhone ? '+' . $realPhone : $c->remote_jid;
        DB::table('whatsapp_chats')->where('id', $c->id)->update(['phone' => $newPhone]);
    }
}
echo "Done!\n";
